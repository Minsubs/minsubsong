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
} from "./lib/db.js";

import {
  selectDueSubscriptions,
  isQuietHour,
  buildPayload,
  validateEventBatch,
  maskEndpoint,
  teamCodeOf,
} from "./lib/push-logic.js";

import { sendPush, importVapidPrivateKey } from "./lib/webpush.js";

// 구독 TTL(ms). 만료된 구독은 cron 에서 reap. 기본 180일.
const SUBSCRIPTION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
// sent_log 보존(ms). 오래된 발송 이력은 cron 에서 정리. 기본 60일.
const SENT_LOG_TTL_MS = 60 * 24 * 60 * 60 * 1000;

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

async function handleFetch(request, env) {
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
// scheduled — 분단위 cron
// ---------------------------------------------------------------------------

async function handleScheduled(event, env, ctx) {
  const now = Date.now();

  // 0) 만료 정리(가벼움) — TTL 지난 구독/오래된 발송로그.
  try {
    await deleteExpired(env.DB, now);
  } catch (err) {
    console.error("reap expired error:", err?.message ?? String(err));
  }

  // 1) 조용한 시간(KST 22:00~08:00)에는 발송하지 않는다(예매오픈 알림은 사용자 가치 알림이나,
  //    명세상 quiet hours 정책을 따른다). 그래도 만료 정리는 위에서 수행.
  if (isQuietHour(now)) {
    return;
  }

  // 2) 배포된 캘린더/메타 fetch — 백엔드는 재계산 없이 데이터 그대로 신뢰.
  const calendar = await fetchJson(env, "ticketing-calendar.json");
  if (!Array.isArray(calendar) || calendar.length === 0) {
    return;
  }

  // 3) 발송 대상 후보 모으기 — topic 매칭 구독을 미리 로드.
  //    캘린더의 홈팀 코드별 ticket_open 구독을 합집합으로 가져온다.
  const leadMinutes = Number(env.PUSH_LEAD_MINUTES ?? 15);
  const subs = await loadCandidateSubs(env, calendar);
  if (subs.length === 0) return;

  // 4) 이미 발송된 (endpoint|topic|gameId) Set 구성.
  const sentSet = await buildSentSet(env, calendar);

  // 5) 순수 선별.
  const due = selectDueSubscriptions({
    games: calendar,
    subs,
    now,
    leadMinutes,
    sentSet,
  });
  if (due.length === 0) return;

  // 6) VAPID 키 준비(개인키는 secret, 공개키는 var). 미설정이면 게이트 — 발송 스킵.
  const vapid = await loadVapid(env);
  if (!vapid) {
    console.warn("VAPID keys not configured — skipping push send (gate).");
    return;
  }

  // 7) 발송 + 410/404 → 삭제. 백그라운드로 묶어 cron 빠르게 반환.
  const work = sendDue(env, due, vapid, now);
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(work);
  } else {
    await work;
  }
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
async function buildSentSet(env, calendar) {
  const set = new Set();
  const seenKeys = new Set();
  for (const game of calendar) {
    const gameId = game?.id != null ? String(game.id) : null;
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

async function sendDue(env, due, vapid, now) {
  const ttl = Number(env.PUSH_TTL_SECONDS ?? 600);
  for (const item of due) {
    const { sub, game, topic, dedupeKey } = item;
    const payload = JSON.stringify(buildPayload(game));
    let result;
    try {
      result = await sendPush({
        subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapid,
        ttl,
        urgency: "high",
      });
    } catch (err) {
      // 발송 실패 — endpoint 평문 금지, 마스킹.
      console.error(`sendPush failed ${maskEndpoint(sub.endpoint)}:`, err?.message ?? String(err));
      continue;
    }

    if (result.gone) {
      // 410/404 → 구독 즉시 삭제.
      try {
        await deleteSubscription(env.DB, sub.endpoint);
      } catch (err) {
        console.error("delete gone sub error:", err?.message ?? String(err));
      }
      continue;
    }

    if (result.ok) {
      try {
        await markSent(env.DB, sub.endpoint, topic, dedupeKey, now);
      } catch (err) {
        console.error("markSent error:", err?.message ?? String(err));
      }
    }
    // 429/5xx 등은 다음 cron 윈도우에서 재시도(아직 due 윈도우 내라면).
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
