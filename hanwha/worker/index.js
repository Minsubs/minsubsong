// worker/index.js
//
// KBO TIDO 푸시 백엔드 — Cloudflare Worker 진입점 (얇은 shell).
//
// 모든 순수 로직은 lib/* 에 있고 단위검증된다. 이 파일은 I/O 결선만 한다:
//   fetch()     — CORS(allowlist) + 구독 등록/해지 + 익명 이벤트 수집 + 메트릭 조회
//   scheduled() — 분단위 cron. 배포된 ticketing-calendar.json/meta.json 을 fetch,
//                 push-logic 으로 예매오픈 임박·미발송·topic 선별, webpush 발송,
//                 410/404 응답이면 D1 에서 구독 삭제.
//
// 프라이버시(BACKEND_PUSH_PLAN.md §4):
//   - endpoint 는 bearer 비밀 → 로그에 평문 금지(maskEndpoint).
//   - 저장은 구독/발송로그/익명 카운트뿐. IP/UA/위치/UUID 등 PII 미수집.
//
// ─────────────────────────────────────────────────────────────────────────────
//  게이트(GATE) — 배포 전 반드시 충족 (worker/README.md 참고)
//   1) VAPID 프로덕션 키쌍: 공개키는 클라/vars 플레이스홀더, 개인키는 wrangler secret.
//   2) 실배포 + 크리덴셜(account_id/CF_API_TOKEN) — 본 워크플로우 범위 밖.
//   3) 실기기 푸시 도달 end-to-end — 실기기에서만 검증 가능.
//   4) D8 법률/개인정보 처리방침 고지.
// ─────────────────────────────────────────────────────────────────────────────

import {
  parseAllowedOrigins,
  isOriginAllowed,
  handlePreflight,
  withCors,
} from "./lib/cors.js";

import {
  serializeTopics,
  upsertSubscription,
  deleteSubscription,
  getByTopic,
  getSentForGame,
  markSent,
  deleteExpired,
  insertEventCounts,
  getMetrics,
  recordCalendarSeen,
  getSeenIds,
  getLiveStates,
  upsertLiveStates,
  deleteOldLiveState,
} from "./lib/db.js";

import {
  selectDueSubscriptions,
  isQuietHour,
  isQuietHourForCategory,
  buildPayload,
  validateEventBatch,
  maskEndpoint,
  teamCodeOf,
  gameIdOf,
  groupDueByEndpoint,
  buildBundlePayload,
  isWeeklyBriefWindow,
  upcomingWeekRange,
  isoWeekKey,
  collectWeeklyOpens,
  weeklyBriefCodes,
  buildWeeklyBriefPayload,
  detectReschedules,
  buildReschedulePayload,
  detectLiveEvents,
  buildLivePayload,
  scheduleStartAt,
  isLiveWindow,
  kstDateStr,
} from "./lib/push-logic.js";

import { sendPush, importVapidPrivateKey } from "./lib/webpush.js";

import { parseScoreboard } from "./lib/scoreboard.js";

// 구독 TTL(ms). 만료된 구독은 cron 에서 reap. 기본 180일.
const SUBSCRIPTION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
// sent_log 보존(ms). 오래된 발송 이력은 cron 에서 정리. 기본 60일.
const SENT_LOG_TTL_MS = 60 * 24 * 60 * 60 * 1000;
// live_state 보존(ms) — 어제 이전 경기 스냅샷 정리. 기본 2일.
const LIVE_STATE_TTL_MS = 2 * 24 * 60 * 60 * 1000;
// 한 cron 틱 발송 총량 상한(F1+F2+F4 합산 — 무료 티어 subrequest 예산 대비).
// 초과분은 이번 틱 중단, 다음 틱에서 sent_log 가 이미 발송분을 제외하고 이어감(F2 청크).
const DEFAULT_MAX_SENDS_PER_TICK = 40;
// 한 틱 내 429(Too Many Requests) 누적 상한 — 초과 시 잔여 발송 중단(폭주 방지).
const DEFAULT_MAX_429 = 5;
// F3 재편성 후보 판정 지평(일) — 경기일이 이 안이면서 새로 나타난 항목만 후보.
const DEFAULT_RESCHEDULE_HORIZON_DAYS = 10;

// ── /api/live 캐시 정책 (LIVE_ALERTS_DESIGN_2026-07.md §2 LV1a) ─────────────
// 엣지 캐시(Cache API, caches.default) TTL — 동시 사용자가 몇 명이든 이 초당
// KBO 원 소스에는 최대 1회만 나가게 한다.
const LIVE_EDGE_CACHE_SECONDS = 25;
// 원 소스 fetch/파싱 실패 시 대체용 stale 캐시 TTL(선택 구현) — 완전 503 대신
// 최근 성공 응답을 좀 더 오래 보관해 순간 장애를 흡수한다.
const LIVE_STALE_CACHE_SECONDS = 600;
// 클라이언트(브라우저)에게 내려주는 Cache-Control max-age — 과폴링 완화용.
// 엣지 TTL(25s)보다 짧게 둬 클라가 너무 오래 같은 응답을 신뢰하지 않게 한다.
const LIVE_CLIENT_CACHE_SECONDS = 15;

// ---------------------------------------------------------------------------
// JSON 응답 헬퍼
// ---------------------------------------------------------------------------

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// 구독 입력 검증 (구조/형식만; PII 없음)
// ---------------------------------------------------------------------------

function validateSubscription(body) {
  if (!body || typeof body !== "object") return null;
  const sub = body.subscription ?? body;
  const endpoint = sub?.endpoint;
  const keys = sub?.keys ?? sub;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) return null;
  if (typeof p256dh !== "string" || p256dh.length === 0) return null;
  if (typeof auth !== "string" || auth.length === 0) return null;
  // 길이 상한(폭주 방지). 정상 Web Push 키는 이보다 훨씬 짧다.
  if (endpoint.length > 2048 || p256dh.length > 512 || auth.length > 256) return null;
  const topics = Array.isArray(body.topics)
    ? body.topics
    : Array.isArray(sub.topics)
      ? sub.topics
      : [];
  return { endpoint, p256dh, auth, topics };
}

// ---------------------------------------------------------------------------
// fetch — HTTP 핸들러
// ---------------------------------------------------------------------------

async function handleFetch(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();
  const origin = request.headers.get("Origin");
  const allowlist = parseAllowedOrigins(env.ALLOWED_ORIGIN);

  // 1) Preflight
  if (method === "OPTIONS") {
    return handlePreflight(request, env.ALLOWED_ORIGIN);
  }

  // 2) Origin 게이트 — 허용 origin 만 처리(no-wildcard). origin 없는 동일출처/도구는 통과.
  if (origin && !isOriginAllowed(origin, allowlist)) {
    return withCors(json({ error: "forbidden_origin" }, 403), request, env.ALLOWED_ORIGIN);
  }

  let response;
  try {
    if (pathname === "/api/subscriptions" && method === "POST") {
      response = await postSubscription(request, env);
    } else if (pathname === "/api/subscriptions" && method === "DELETE") {
      response = await deleteSubscriptionRoute(request, env);
    } else if (pathname === "/api/events" && method === "POST") {
      response = await postEvents(request, env);
    } else if (pathname === "/api/metrics" && method === "GET") {
      response = await getMetricsRoute(env);
    } else if (pathname === "/api/live" && method === "GET") {
      response = await getLiveRoute(request, env, ctx);
    } else {
      response = json({ error: "not_found" }, 404);
    }
  } catch (err) {
    // 절대 endpoint/본문 평문 로그 금지 — 메시지만.
    console.error("fetch handler error:", err?.message ?? String(err));
    response = json({ error: "internal_error" }, 500);
  }

  return withCors(response, request, env.ALLOWED_ORIGIN);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function postSubscription(request, env) {
  const body = await readJsonBody(request);
  const sub = validateSubscription(body);
  if (!sub) return json({ error: "invalid_subscription" }, 400);

  const now = Date.now();
  await upsertSubscription(env.DB, sub, now, now + SUBSCRIPTION_TTL_MS);
  return json({ ok: true, topics: JSON.parse(serializeTopics(sub.topics)) }, 201);
}

async function deleteSubscriptionRoute(request, env) {
  const body = await readJsonBody(request);
  const endpoint = body?.endpoint ?? body?.subscription?.endpoint;
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) {
    return json({ error: "invalid_endpoint" }, 400);
  }
  await deleteSubscription(env.DB, endpoint);
  return json({ ok: true }, 200);
}

async function postEvents(request, env) {
  const body = await readJsonBody(request);
  const { ok, events } = validateEventBatch(body);
  if (!ok) return json({ error: "invalid_events" }, 400);

  // metric -> count 합산. team_interest 의 key 는 집계 차원으로만 사용.
  const counts = {};
  for (const ev of events) {
    const metric = ev.key ? `${ev.name}:${ev.key}` : ev.name;
    counts[metric] = (counts[metric] ?? 0) + ev.count;
  }
  const day = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  await insertEventCounts(env.DB, counts, day);
  return json({ ok: true, accepted: events.length }, 202);
}

async function getMetricsRoute(env) {
  const rows = await getMetrics(env.DB);
  // 집계 카운트만 반환 — 식별자 없음.
  return json({ ok: true, metrics: rows }, 200);
}

// ---------------------------------------------------------------------------
// GET /api/live — 라이브 스코어 프록시 (LIVE_ALERTS_DESIGN_2026-07.md §2 LV1a)
//
// env.SCOREBOARD_URL(KBO 스코어보드 HTML) 을 온디맨드로 fetch 해 scoreboard.js
// 로 파싱하고, 결과를 caches.default 에 25초 엣지 캐시한다. 동시 사용자가
// 몇 명이든 캐시 TTL 당 원 소스에는 최대 1회만 나간다. 실패 시 stale 캐시가
// 있으면 그것을 대체 반환하고, 없으면 503.
// ---------------------------------------------------------------------------

function liveCacheKeys(request) {
  // 캐시 키 정규화 — 쿼리스트링/오리진 차이와 무관하게 항상 같은 슬롯을 쓴다.
  const origin = new URL(request.url).origin;
  const base = `${origin}/api/live`;
  return {
    primary: new Request(base, { method: "GET" }),
    stale: new Request(`${base}?variant=stale`, { method: "GET" }),
  };
}

// 캐시/원본 Response 에 클라용 Cache-Control(max-age=15)을 씌워 새 Response 를
// 만든다. 엣지 저장용 Cache-Control(s-maxage)과 클라에 보내는 정책을 분리한다.
function withClientCacheHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${LIVE_CLIENT_CACHE_SECONDS}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getLiveRoute(request, env, ctx) {
  const cache = caches.default;
  const { primary: cacheKey, stale: staleCacheKey } = liveCacheKeys(request);

  // 1) 엣지 캐시 hit — 원 소스 fetch 없이 즉시 반환.
  const cached = await cache.match(cacheKey);
  if (cached) {
    return withClientCacheHeaders(cached);
  }

  // 2) 원 소스 fetch.
  const sourceUrl = env.SCOREBOARD_URL;
  let html = null;
  let fetchErrorMessage = null;
  if (!sourceUrl) {
    fetchErrorMessage = "SCOREBOARD_URL not configured";
  } else {
    try {
      const res = await fetch(sourceUrl, { cf: { cacheTtl: 0 } });
      if (!res.ok) {
        throw new Error(`upstream status ${res.status}`);
      }
      html = await res.text();
    } catch (err) {
      fetchErrorMessage = err?.message ?? String(err);
    }
  }

  if (html === null) {
    console.error("live scoreboard fetch error:", fetchErrorMessage);
    return await staleOrFail(cache, staleCacheKey);
  }

  // 3) 파싱 — scoreboard.js 순수 함수(앱 parseScoreboard 포팅).
  let games;
  try {
    games = parseScoreboard(html);
  } catch (err) {
    console.error("live scoreboard parse error:", err?.message ?? String(err));
    return await staleOrFail(cache, staleCacheKey);
  }

  // 4) 성공 — 엣지 캐시(25s) + stale 캐시(10분) 둘 다 기록, 클라에는 max-age=15.
  const payload = JSON.stringify({ ok: true, fetchedAt: Date.now(), games });
  const edgeResponse = new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${LIVE_EDGE_CACHE_SECONDS}`,
    },
  });
  const staleResponse = new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${LIVE_STALE_CACHE_SECONDS}`,
    },
  });
  // clone 은 반드시 body 를 아무도 읽기 전에 동기적으로 호출한다.
  const toCache = edgeResponse.clone();
  const writes = Promise.all([cache.put(cacheKey, toCache), cache.put(staleCacheKey, staleResponse)]);
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(writes);
  } else {
    await writes;
  }

  return withClientCacheHeaders(edgeResponse);
}

// 원 소스 실패 시 stale 캐시가 있으면 그것을 반환하고, 없으면 503.
async function staleOrFail(cache, staleCacheKey) {
  const staleHit = await cache.match(staleCacheKey);
  if (staleHit) {
    return withClientCacheHeaders(staleHit);
  }
  return json({ ok: false, games: [] }, 503);
}

// ---------------------------------------------------------------------------
// scheduled — 분단위 cron
// ---------------------------------------------------------------------------

async function handleScheduled(event, env, ctx) {
  const now = Date.now();

  // 0) 만료 정리(가벼움) — TTL 지난 구독/오래된 발송로그/라이브 스냅샷.
  try {
    await deleteExpired(env.DB, now);
  } catch (err) {
    console.error("reap expired error:", err?.message ?? String(err));
  }
  try {
    await deleteOldLiveState(env.DB, now - LIVE_STATE_TTL_MS);
  } catch (err) {
    console.error("reap live_state error:", err?.message ?? String(err));
  }

  // VAPID 키(개인키는 secret, 공개키는 var). 미설정/플레이스홀더면 발송 스킵(게이트).
  // 단, 상태 기록(F3 calendar_seen / F4 live_state)은 키 없이도 baseline 을 쌓는다.
  const vapid = await loadVapid(env);
  const sender = vapid ? createSender(env, vapid) : null;
  if (!vapid) {
    console.warn("VAPID keys not configured — recording state only, skipping sends (gate).");
  }

  const work = (async () => {
    // 발송 우선순위(공유 sender 의 한 틱 총량 예산 대비): 시간민감(F1 오픈 임박,
    // F4 라이브 — 놓치면 전이 이벤트 소실) 먼저, 지연 가능(F2 주간 — dedup 로 다음 틱
    // 이어감) 마지막.
    let calendar = null;
    // 예매 계열은 quiet hour(KST 22:00~08:00) 기존 정책 준수(F1 불변, F3 존중).
    // F2 는 일요일 20:00 이라 quiet 아님.
    if (!isQuietHour(now)) {
      calendar = await fetchJson(env, "ticketing-calendar.json");
    }
    const haveCalendar = Array.isArray(calendar) && calendar.length > 0;

    // F3 재편성 baseline 기록 + 후보 발송(콜드스타트 가드는 내부에서).
    if (haveCalendar) await runReschedule(env, { calendar, now, sender });
    // F1 오픈 임박 묶음/개별.
    if (haveCalendar) await runTicketOpen(env, { calendar, now, sender });
    // F4 game_live — 자체 창(첫 경기 -20분~23:30) + 야간 예외(23:30까지).
    await runLiveMonitor(env, { now, sender });
    // F2 주간 브리핑 — 지연 가능하므로 마지막(예산 소진 시 다음 틱 청크 이어감).
    if (haveCalendar && isWeeklyBriefWindow(now)) {
      await runWeeklyBrief(env, { calendar, now, sender });
    }
  })();

  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(work);
  } else {
    await work;
  }
}

// ---------------------------------------------------------------------------
// 발송기(sender) — 429 백오프(T1) + 한 틱 발송 총량 상한(F2 청크·F4 합산).
// 410/404 → 즉시 삭제. gone/ok/skip 결과를 호출부에 반환.
// ---------------------------------------------------------------------------

function createSender(env, vapid) {
  const ttl = Number(env.PUSH_TTL_SECONDS ?? 600);
  const liveTtl = Number(env.PUSH_LIVE_TTL_SECONDS ?? 300);
  const maxSends = Number(env.PUSH_MAX_SENDS_PER_TICK ?? DEFAULT_MAX_SENDS_PER_TICK);
  const max429 = Number(env.PUSH_MAX_429 ?? DEFAULT_MAX_429);
  let sends = 0;
  let count429 = 0;
  let halted = false;

  return {
    get halted() {
      return halted;
    },
    // category: "game_live" 면 짧은 TTL(임박성). 반환: {ok|gone|retry|skipped|error}.
    async send({ sub, payload, urgency, category, topic, dedupeKey, now }) {
      if (halted) return { skipped: true };
      if (sends >= maxSends) {
        halted = true; // 총량 상한 — 잔여는 다음 틱(sent_log 가 발송분 제외).
        return { skipped: true };
      }
      sends += 1;
      let result;
      try {
        result = await sendPush({
          subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload: typeof payload === "string" ? payload : JSON.stringify(payload),
          vapid,
          ttl: category === "game_live" ? liveTtl : ttl,
          urgency: urgency ?? "normal",
        });
      } catch (err) {
        console.error(`sendPush failed ${maskEndpoint(sub.endpoint)}:`, err?.message ?? String(err));
        return { error: true };
      }

      if (result.gone) {
        try {
          await deleteSubscription(env.DB, sub.endpoint);
        } catch (err) {
          console.error("delete gone sub error:", err?.message ?? String(err));
        }
        return { gone: true };
      }

      if (result.status === 429) {
        // T1: Retry-After 로그(마스킹) + 이 endpoint 이번 틱 skip(다음 cron 재시도).
        count429 += 1;
        console.warn(
          `push 429 backoff ${maskEndpoint(sub.endpoint)} retryAfter=${result.retryAfter ?? "?"}s (${count429}/${max429})`,
        );
        if (count429 > max429) {
          halted = true; // 폭주 방지 — 잔여 발송 중단.
          console.warn("429 cap exceeded — halting remaining sends this tick.");
        }
        return { retry: true, retryAfter: result.retryAfter };
      }

      if (result.ok) {
        try {
          await markSent(env.DB, sub.endpoint, topic, dedupeKey, now);
        } catch (err) {
          console.error("markSent error:", err?.message ?? String(err));
        }
        return { ok: true };
      }
      return { status: result.status };
    },
  };
}

// ---------------------------------------------------------------------------
// 예매 계열 결선 — F1(묶음) / F2(주간) / F3(재편성)
// ---------------------------------------------------------------------------

// F1. 오픈 임박 발송 — endpoint 단위 묶음(2건+) / 개별(1건).
async function runTicketOpen(env, { calendar, now, sender }) {
  const leadMinutes = Number(env.PUSH_LEAD_MINUTES ?? 15);
  const subs = await loadCandidateSubs(env, calendar);
  if (subs.length === 0) return;
  const sentSet = await buildSentSet(env, calendar);
  const due = selectDueSubscriptions({ games: calendar, subs, now, leadMinutes, sentSet });
  if (due.length === 0 || !sender) return;

  for (const group of groupDueByEndpoint(due)) {
    if (sender.halted) break;
    const { sub, items } = group;
    // 묶음(2건+)이면 1건으로, 아니면 개별 페이로드.
    const payload = items.length >= 2 ? buildBundlePayload(items) : buildPayload(items[0].game);
    if (!payload) continue;
    const result = await sender.send({
      sub,
      payload,
      urgency: "high",
      topic: items[0].topic,
      dedupeKey: items[0].dedupeKey,
      now,
    });
    // 성공 시: 묶음에 포함된 각 (endpoint, gameId) 를 개별 markSent — 중복 발송 금지.
    if (result.ok && items.length >= 2) {
      for (const it of items.slice(1)) {
        try {
          await markSent(env.DB, sub.endpoint, it.topic, it.dedupeKey, now);
        } catch (err) {
          console.error("bundle markSent error:", err?.message ?? String(err));
        }
      }
    }
  }
}

// F2. 주간 예매 브리핑 — 일요일 20:00, 다가오는 주(월~일) 오픈 요약 1건/구독.
async function runWeeklyBrief(env, { calendar, now, sender }) {
  if (!sender) return;
  const { start, end } = upcomingWeekRange(now);
  const isoWeek = isoWeekKey(start); // 다가오는 주의 ISO 주차
  const dedupeKey = `weekly:${isoWeek}`;
  const year = new Date(start).getUTCFullYear() || new Date(now).getUTCFullYear();

  // 이 주에 오픈 있는 팀 코드만 대상(오픈 0건 팀은 애초에 제외).
  const weekOpens = collectWeeklyOpens({ games: calendar, codes: null, weekStart: start, weekEnd: end, year });
  if (weekOpens.length === 0) return; // 이번 주 오픈 0건 → 발송 안 함.
  const activeCodes = new Set(weekOpens.map((o) => o.code));

  // weekly_brief 구독 로드(활성 코드별) + endpoint 중복 제거.
  const byEndpoint = new Map();
  for (const code of activeCodes) {
    let rows;
    try {
      rows = await getByTopic(env.DB, `${code}:weekly_brief`);
    } catch (err) {
      console.error("getByTopic weekly error:", err?.message ?? String(err));
      continue;
    }
    for (const sub of rows) byEndpoint.set(sub.endpoint, sub);
  }
  if (byEndpoint.size === 0) return;

  // 이미 이번 주 발송한 endpoint 제외(dedup weekly:<ISO주차>).
  const sentEndpoints = new Set();
  try {
    for (const row of await getSentForGame(env.DB, dedupeKey)) sentEndpoints.add(row.endpoint);
  } catch (err) {
    console.error("weekly getSent error:", err?.message ?? String(err));
  }

  for (const sub of byEndpoint.values()) {
    if (sender.halted) break;
    if (sentEndpoints.has(sub.endpoint)) continue;
    // 구독의 weekly_brief 팀들 중 이 주 오픈만 모아 요약(0건이면 스킵).
    const codes = weeklyBriefCodes(sub);
    const opens = collectWeeklyOpens({ games: calendar, codes, weekStart: start, weekEnd: end, year });
    if (opens.length === 0) continue;
    const payload = buildWeeklyBriefPayload({ opens, isoWeek });
    await sender.send({ sub, payload, urgency: "normal", topic: "weekly_brief", dedupeKey, now });
  }
}

// F3. 재편성(더블헤더) 발표 감지 — calendar_seen diff. baseline 은 키 없이도 기록.
async function runReschedule(env, { calendar, now, sender }) {
  let seenIds = [];
  try {
    seenIds = await getSeenIds(env.DB);
  } catch (err) {
    console.error("getSeenIds error:", err?.message ?? String(err));
    return;
  }
  const year = new Date(now).getUTCFullYear();
  const horizonDays = Number(env.RESCHEDULE_HORIZON_DAYS ?? DEFAULT_RESCHEDULE_HORIZON_DAYS);
  const { newIds, candidates, coldStart } = detectReschedules({
    seenIds,
    calendar,
    now,
    year: yearInKst(now, year),
    horizonDays,
  });

  // 신규 game_id 기록(first_seen=now). 콜드스타트든 아니든 baseline 은 항상 갱신.
  if (newIds.length > 0) {
    try {
      await recordCalendarSeen(env.DB, newIds, now);
    } catch (err) {
      console.error("recordCalendarSeen error:", err?.message ?? String(err));
    }
  }
  // 콜드스타트(최초 1회) 또는 후보 없음 → 발송 없음.
  if (coldStart || candidates.length === 0 || !sender) return;

  for (const { game } of candidates) {
    if (sender.halted) break;
    const homeCode = teamCodeOf(game?.home);
    const awayCode = teamCodeOf(game?.away);
    const codes = [...new Set([homeCode, awayCode].filter(Boolean))];
    if (codes.length === 0) continue;
    const dedupeKey = `resched:${gameIdOf(game)}`;
    const subsByCode = await loadSubsByCode(env, codes, "ticket_open");
    // 이미 이 재편성 발송한 endpoint 제외.
    const sent = new Set();
    try {
      for (const row of await getSentForGame(env.DB, dedupeKey)) sent.add(row.endpoint);
    } catch (err) {
      console.error("resched getSent error:", err?.message ?? String(err));
    }
    const payload = buildReschedulePayload(game);
    const seenEndpoint = new Set();
    for (const code of codes) {
      for (const sub of subsByCode.get(code) ?? []) {
        if (sender.halted) break;
        if (seenEndpoint.has(sub.endpoint) || sent.has(sub.endpoint)) continue;
        seenEndpoint.add(sub.endpoint);
        await sender.send({ sub, payload, urgency: "normal", topic: "ticket_open", dedupeKey, now });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// F4. LV2 라이브 모니터 — 스코어보드 diff → game_live 발송
// ---------------------------------------------------------------------------

async function runLiveMonitor(env, { now, sender }) {
  // 야간 예외 정책(23:30까지) — 그 밖은 발송 금지. 상태 diff 자체도 창 밖이면 스킵.
  if (isQuietHourForCategory(now, "game_live")) return;

  const schedule = await fetchJson(env, "live-game.json");
  if (!Array.isArray(schedule) || schedule.length === 0) return; // 오늘 경기 0건.

  const dayStr = kstDateStr(now);
  const startAts = schedule.map((g) => scheduleStartAt(g, dayStr)).filter((x) => x != null);
  if (!isLiveWindow(startAts, now)) return; // 첫 경기 -20분 ~ 23:30 창 밖.

  // 스코어보드 실시간 fetch — /api/live 와 동일 소스/파서(scoreboard.js) 재사용.
  const current = await fetchScoreboardGames(env);
  if (current === null) return; // fetch/파싱 실패 — 이번 틱 스킵(다음 재시도).

  let prevStates = [];
  try {
    prevStates = await getLiveStates(env.DB);
  } catch (err) {
    console.error("getLiveStates error:", err?.message ?? String(err));
  }

  const { events, upserts } = detectLiveEvents({
    current,
    schedule,
    prevStates,
    now,
    options: { dayStr },
  });

  // 상태 스냅샷 갱신(발송 성공 여부와 무관 — 다음 틱 diff baseline).
  if (upserts.length > 0) {
    try {
      await upsertLiveStates(env.DB, upserts);
    } catch (err) {
      console.error("upsertLiveStates error:", err?.message ?? String(err));
    }
  }
  if (events.length === 0 || !sender) return;

  // 이벤트 대상 코드별 game_live 구독 로드.
  const codes = new Set();
  for (const ev of events) for (const c of ev.targetCodes ?? []) codes.add(c);
  const subsByCode = await loadSubsByCode(env, [...codes], "game_live");

  // dedup — 이벤트별 이미 발송된 endpoint.
  const sentByKey = new Map();
  for (const ev of events) {
    if (sentByKey.has(ev.dedupKey)) continue;
    const set = new Set();
    try {
      for (const row of await getSentForGame(env.DB, ev.dedupKey)) set.add(row.endpoint);
    } catch (err) {
      console.error("live getSent error:", err?.message ?? String(err));
    }
    sentByKey.set(ev.dedupKey, set);
  }

  for (const ev of events) {
    if (sender.halted) break;
    const payload = buildLivePayload(ev);
    const urgency = ev.type === "start" || ev.type === "canceled" || ev.type === "delayed" ? "high" : "normal";
    const already = sentByKey.get(ev.dedupKey) ?? new Set();
    const seenEndpoint = new Set();
    for (const code of ev.targetCodes ?? []) {
      for (const sub of subsByCode.get(code) ?? []) {
        if (sender.halted) break;
        if (seenEndpoint.has(sub.endpoint) || already.has(sub.endpoint)) continue;
        seenEndpoint.add(sub.endpoint);
        await sender.send({ sub, payload, urgency, category: "game_live", topic: "game_live", dedupeKey: ev.dedupKey, now });
      }
    }
  }
}

// 스코어보드 HTML fetch + 파싱(순수). 실패 시 null.
async function fetchScoreboardGames(env) {
  const sourceUrl = env.SCOREBOARD_URL;
  if (!sourceUrl) return null;
  try {
    const res = await fetch(sourceUrl, { cf: { cacheTtl: 0 } });
    if (!res.ok) return null;
    return parseScoreboard(await res.text());
  } catch (err) {
    console.error("live scoreboard fetch error:", err?.message ?? String(err));
    return null;
  }
}

// "<CODE>:<category>" 토픽 구독을 코드별 배열 Map 으로 로드.
async function loadSubsByCode(env, codes, category) {
  const map = new Map();
  for (const code of codes) {
    if (!code) continue;
    let rows;
    try {
      rows = await getByTopic(env.DB, `${code}:${category}`);
    } catch (err) {
      console.error("getByTopic error:", err?.message ?? String(err));
      rows = [];
    }
    map.set(code, rows);
  }
  return map;
}

// now 의 KST 연도(연말/연초 경계 방어). 실패 시 fallback.
function yearInKst(now, fallback) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" })
    .formatToParts(new Date(now))
    .find((x) => x.type === "year");
  return p ? Number(p.value) : fallback;
}

async function fetchJson(env, name) {
  const base = (env.DATA_BASE_URL ?? "").replace(/\/+$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/data/${name}?cron=${Date.now()}`, {
      cf: { cacheTtl: 0 },
      headers: { "Cache-Control": "no-store" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`fetch ${name} error:`, err?.message ?? String(err));
    return null;
  }
}

// 캘린더 홈팀 → "<CODE>:ticket_open" 토픽 구독 합집합.
async function loadCandidateSubs(env, calendar) {
  const topics = new Set();
  for (const game of calendar) {
    const code = teamCodeOf(game?.home);
    if (code) topics.add(`${code}:ticket_open`);
  }
  const byEndpoint = new Map();
  for (const topic of topics) {
    let rows;
    try {
      rows = await getByTopic(env.DB, topic);
    } catch (err) {
      console.error("getByTopic error:", err?.message ?? String(err));
      continue;
    }
    for (const sub of rows) {
      byEndpoint.set(sub.endpoint, sub); // de-dup by endpoint
    }
  }
  return [...byEndpoint.values()];
}

// 캘린더 경기들의 dedup_key(gameId) 발송 이력을 모아 "endpoint|topic|gameId" Set 으로.
// gameId 는 push-logic gameIdOf(캘린더에 id 필드가 없어 home+date+time). selectDue 의
// dedupeKey / markSent 와 동일 키를 써야 틱 간 once-per-key 캡이 성립한다.
async function buildSentSet(env, calendar) {
  const set = new Set();
  const seenKeys = new Set();
  for (const game of calendar) {
    const gameId = gameIdOf(game);
    if (!gameId || seenKeys.has(gameId)) continue;
    seenKeys.add(gameId);
    let rows;
    try {
      rows = await getSentForGame(env.DB, gameId);
    } catch (err) {
      console.error("getSentForGame error:", err?.message ?? String(err));
      continue;
    }
    for (const row of rows) {
      set.add(`${row.endpoint}|${row.topic}|${row.dedup_key}`);
    }
  }
  return set;
}

async function loadVapid(env) {
  const publicKey = env.VAPID_PUBLIC;
  const privateKeyRaw = env.VAPID_PRIVATE; // wrangler secret only
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKeyRaw || !subject) return null;
  // 플레이스홀더면 게이트 — 발송 안 함.
  if (/placeholder|REPLACE|xxxx/i.test(publicKey)) return null;
  try {
    const privateKey = await importVapidPrivateKey({
      privateKey: privateKeyRaw,
      publicKey,
    });
    return { publicKey, privateKey, subject };
  } catch (err) {
    console.error("VAPID import error:", err?.message ?? String(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    return handleFetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    return handleScheduled(event, env, ctx);
  },
};
