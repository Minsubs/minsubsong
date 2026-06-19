// worker/lib/push-logic.js
//
// 순수 함수 모음 — I/O 없음(DB/네트워크/타이머/env 접근 금지).
// Worker 진입점(index.js)과 발송 스케줄러가 import 해서 쓰는 "두뇌".
// 모든 부수효과(D1, web-push, fetch)는 호출부가 담당한다.
//
// 프라이버시 원칙(BACKEND_PUSH_PLAN.md 4장):
//  - endpoint 는 bearer 비밀 → 로그/집계에 평문 금지(maskEndpoint).
//  - 익명 카운트만 수집(validateEventBatch) — IP/UA/UUID/endpoint 등 식별자 제거.
//  - 조용한 시간 22:00~08:00 KST(isQuietHour) — ticket_open 예외는 호출부 정책.

// ---------------------------------------------------------------------------
// 팀명 → 표준 KBO 코드
// ---------------------------------------------------------------------------

const TEAM_CODES = new Set(["HH", "OB", "LG", "SK", "WO", "HT", "SS", "LT", "NC", "KT"]);

// 한글/영문/별칭 → 표준 코드. 혼합 표기 흡수.
const TEAM_ALIASES = {
  // 한화 이글스
  한화: "HH", hanwha: "HH", eagles: "HH",
  // 두산 베어스 (OB 베어스 유산 코드)
  두산: "OB", doosan: "OB", bears: "OB",
  // LG 트윈스
  lg: "LG", 엘지: "LG", twins: "LG",
  // SSG 랜더스 (SK 와이번스 유산 코드)
  ssg: "SK", sk: "SK", landers: "SK", 랜더스: "SK",
  // 키움 히어로즈 (우리/넥센 유산 코드 WO)
  키움: "WO", kiwoom: "WO", heroes: "WO", 넥센: "WO", nexen: "WO",
  // KIA 타이거즈 (해태 유산 코드 HT)
  kia: "HT", 기아: "HT", 해태: "HT", tigers: "HT",
  // 삼성 라이온즈
  삼성: "SS", samsung: "SS", lions: "SS",
  // 롯데 자이언츠
  롯데: "LT", lotte: "LT", giants: "LT",
  // NC 다이노스
  nc: "NC", 엔씨: "NC", dinos: "NC",
  // KT 위즈
  kt: "KT", 케이티: "KT", wiz: "KT",
};

export function teamCodeOf(homeName) {
  if (typeof homeName !== "string") return null;
  const trimmed = homeName.trim();
  if (!trimmed) return null;
  if (TEAM_CODES.has(trimmed)) return trimmed; // 이미 코드
  const upper = trimmed.toUpperCase();
  if (TEAM_CODES.has(upper)) return upper;
  return TEAM_ALIASES[trimmed] ?? TEAM_ALIASES[trimmed.toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// 예매 오픈 시각 파생 (update-data.mjs ticketOpenTimestamp 포팅)
// ---------------------------------------------------------------------------
//
// 입력: game.date "MM.DD", game.ticketing.openDaysBefore(정수), openTime "HH:MM", year.
// 출력: 오픈 시각(KST 벽시계)의 epoch ms. 부족/형식오류면 null(fail-closed).
//
// Dec-Jan 연도 경계: openDaysBefore 만큼 뺀 날이 전년도로 넘어가도 정확해야 한다.
// → 항상 KST(+09:00) 기준으로 Date 를 만들고 setUTCDate 로 일수 차감해
//   호스트 타임존과 무관하게 결정적으로 계산한다.

export function deriveOpenAt(game, year) {
  if (!game || typeof game !== "object") return null;
  const ticketing = game.ticketing;
  if (!ticketing || typeof ticketing !== "object") return null;

  const md = String(game.date ?? "").match(/^(\d{2})\.(\d{2})$/);
  if (!md) return null;
  const month = Number(md[1]);
  const day = Number(md[2]);

  const daysBefore = Number(ticketing.openDaysBefore);
  if (!Number.isFinite(daysBefore) || daysBefore <= 0) return null;

  const tm = String(ticketing.openTime ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return null;
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) return null;

  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  // 경기 시각(KST). UTC 로는 -9h 오프셋이므로 Date.UTC 에 hour-9 를 직접 넣지 않고
  // ISO(+09:00) 파싱으로 명확히 KST 벽시계를 고정한다.
  const pad = (n) => String(n).padStart(2, "0");
  const openWall = `${y}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
  const base = Date.parse(openWall);
  if (Number.isNaN(base)) return null;

  // openDaysBefore 일 차감 — UTC ms 산술로 연/월 경계 자동 처리.
  const openAt = base - daysBefore * 86_400_000;
  return openAt;
}

// ---------------------------------------------------------------------------
// 조용한 시간 (KST 22:00~08:00)
// ---------------------------------------------------------------------------

export function isQuietHour(epochMs, tz = "Asia/Seoul") {
  const hour = hourInTimeZone(epochMs, tz);
  if (hour === null) return false;
  return hour >= 22 || hour < 8;
}

function hourInTimeZone(epochMs, tz) {
  const t = Number(epochMs);
  if (!Number.isFinite(t)) return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  // hourCycle 차이로 "24" 가 나올 수 있어 mod 24 로 정규화.
  const part = fmt.formatToParts(new Date(t)).find((p) => p.type === "hour");
  if (!part) return null;
  return Number(part.value) % 24;
}

// ---------------------------------------------------------------------------
// 빈도 캡 — 같은 (endpoint, topic, dedupeKey) 조합 1회만
// ---------------------------------------------------------------------------

export function allowByFrequencyCap(sub, topic, dedupeKey, sentRows) {
  const endpoint = sub?.endpoint;
  if (!endpoint || !Array.isArray(sentRows)) return true;
  return !sentRows.some(
    (row) =>
      row &&
      row.endpoint === endpoint &&
      row.topic === topic &&
      row.dedupe_key === dedupeKey,
  );
}

// ---------------------------------------------------------------------------
// 발송 대상 선별
// ---------------------------------------------------------------------------
//
// games: 캘린더 항목 배열({id, home, date, time, ticketing{openDaysBefore, openTime}}).
// subs: 구독 배열({endpoint, topics:["HH:ticket_open", ...]}).
// now: 현재 epoch ms. leadMinutes: 오픈 몇 분 전부터 발송할지.
// sentSet: 이미 발송된 "endpoint|topic|gameId" 문자열 Set.
//
// due 판정: leadMinutes 윈도우 안 (openAt - lead <= now <= openAt) & topic 매칭 & 미발송.
// 반환: [{ sub, game, topic, openAt, dedupeKey }] (호출부가 buildPayload + 발송).

export function selectDueSubscriptions({ games, subs, now, leadMinutes, sentSet }) {
  const result = [];
  if (!Array.isArray(games) || !Array.isArray(subs)) return result;

  const nowMs = Number(now);
  const lead = Number(leadMinutes);
  if (!Number.isFinite(nowMs) || !Number.isFinite(lead)) return result;
  const leadMs = lead * 60_000;
  const sent = sentSet instanceof Set ? sentSet : new Set();

  // 연도는 now 의 KST 연도 기준.
  const year = yearInTimeZone(nowMs, "Asia/Seoul");

  // due 인 경기 + 홈팀 코드 + openAt 미리 계산.
  const dueGames = [];
  for (const game of games) {
    const openAt = deriveOpenAt(game, year);
    if (openAt === null) continue;
    // 윈도우: 오픈 lead 분 전 ~ 오픈 시각. 이미 지났거나 아직 멀면 제외.
    if (nowMs < openAt - leadMs || nowMs > openAt) continue;
    const code = teamCodeOf(game.home);
    if (!code) continue;
    dueGames.push({ game, openAt, code, gameId: gameKey(game) });
  }
  if (!dueGames.length) return result;

  for (const sub of subs) {
    const topics = Array.isArray(sub?.topics) ? sub.topics : [];
    if (!topics.length) continue;
    for (const { game, openAt, code, gameId } of dueGames) {
      // ticket_open 토픽만 이 경로에서 발송(예매 오픈 임박).
      const topic = "ticket_open";
      if (!topics.includes(`${code}:${topic}`)) continue;
      const dedupeKey = gameId;
      if (sent.has(`${sub.endpoint}|${topic}|${dedupeKey}`)) continue;
      result.push({ sub, game, topic, openAt, dedupeKey });
    }
  }
  return result;
}

function gameKey(game) {
  if (game?.id != null) return String(game.id);
  // id 없으면 home+date+time 으로 안정적 키 생성.
  return [teamCodeOf(game?.home) ?? game?.home ?? "", game?.date ?? "", game?.time ?? ""].join("-");
}

function yearInTimeZone(epochMs, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" });
  const part = fmt.formatToParts(new Date(Number(epochMs))).find((p) => p.type === "year");
  return part ? Number(part.value) : new Date(Number(epochMs)).getUTCFullYear();
}

// ---------------------------------------------------------------------------
// 페이로드 — ≤2KB JSON (Safari 상한)
// ---------------------------------------------------------------------------

const MAX_PAYLOAD_BYTES = 2048;

// Buffer 가 없는 런타임(Cloudflare Workers) 대비 — Buffer 미존재 시 TextEncoder fallback.
const byteLen =
  typeof Buffer !== "undefined" && typeof Buffer.byteLength === "function"
    ? (s) => Buffer.byteLength(s, "utf8")
    : (s) => new TextEncoder().encode(s).length;

export function buildPayload(game) {
  const home = String(game?.home ?? "").slice(0, 20);
  const away = String(game?.away ?? "").slice(0, 20);
  const date = String(game?.date ?? "").slice(0, 10);
  const url = sanitizeUrl(game?.ticketing?.url);

  const matchup = away ? `${home} vs ${away}` : home;
  const payload = {
    title: "예매 오픈 임박",
    body: `${date} ${matchup} 예매가 곧 열립니다.`.trim().slice(0, 120),
    url,
    tag: `eagles-ticket-due-${gameKey(game)}`.slice(0, 100),
  };

  // 2KB 보장 — 초과 시 body 를 점진 절단, 그래도 넘으면 최소형으로.
  return clampPayload(payload);
}

function sanitizeUrl(raw) {
  const url = String(raw ?? "").slice(0, 300);
  if (/^https:\/\//.test(url)) return url;
  return "https://kbo-tido.app/"; // 안전 기본값(클라가 자체 라우팅)
}

function clampPayload(payload) {
  let body = payload.body;
  // 우선 body 길이를 줄여 본다.
  for (let i = 0; i < 8; i += 1) {
    const candidate = { ...payload, body };
    if (byteLen(JSON.stringify(candidate)) <= MAX_PAYLOAD_BYTES) {
      return candidate;
    }
    body = body.slice(0, Math.max(0, Math.floor(body.length / 2)));
  }
  // 그래도 넘으면 url/tag 까지 최소화.
  return {
    title: payload.title.slice(0, 40),
    body: "예매가 곧 열립니다.",
    url: "https://kbo-tido.app/",
    tag: payload.tag.slice(0, 60),
  };
}

// ---------------------------------------------------------------------------
// endpoint 마스킹 — 평문 금지, 안정적 해시
// ---------------------------------------------------------------------------

export function maskEndpoint(endpoint) {
  const s = typeof endpoint === "string" ? endpoint : "";
  if (!s) return "ep:empty";
  return `ep:${fnv1a(s)}`;
}

// FNV-1a 32bit — 비암호화 안정 해시(상관관계 추적용, 역산 의도 아님).
function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// 익명 이벤트 배치 검증 — 카운트만, PII/식별자 제거
// ---------------------------------------------------------------------------

const ALLOWED_EVENTS = new Set([
  "app_open",
  "ticket_open_click",
  "team_interest",
  "cancel_watch",
  "subscribe",
  "unsubscribe",
]);

const MAX_COUNT = 1000;
const MAX_EVENTS = 50;

export function validateEventBatch(body) {
  if (!body || typeof body !== "object") return { ok: false, events: [] };
  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) return { ok: false, events: [] };
  if (events.length > MAX_EVENTS) return { ok: false, events: [] };

  const clean = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") return { ok: false, events: [] };
    if (!ALLOWED_EVENTS.has(ev.name)) return { ok: false, events: [] };
    const count = ev.count;
    if (!Number.isInteger(count) || count <= 0) return { ok: false, events: [] };

    // 카운트만 통과 — 식별자/PII 필드는 절대 보존하지 않는다(allow-list).
    const out = { name: ev.name, count: Math.min(count, MAX_COUNT) };
    // key 는 집계 차원(예: 관심구단 코드)으로만 허용, 짧은 코드로 제한.
    if (typeof ev.key === "string" && ev.key.length > 0 && ev.key.length <= 8) {
      out.key = ev.key;
    }
    clean.push(out);
  }
  return { ok: true, events: clean };
}
