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
    dueGames.push({ game, openAt, code, gameId: gameIdOf(game) });
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

// 경기 안정 식별자. 캘린더 항목에는 id 필드가 없으므로(home+date+time) 으로
// 결정적 키를 만든다. selectDueSubscriptions 의 dedupeKey, sent_log dedup_key,
// calendar_seen.game_id 가 모두 이 값을 공유해야 틱 간 dedup 이 일관된다.
export function gameIdOf(game) {
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
// 페이로드 — DWP(Declarative Web Push) + 레거시 SW 겸용, ≤2KB JSON (Safari 상한)
// ---------------------------------------------------------------------------
//
// T2: 하나의 페이로드에 두 형식을 병기한다.
//  - DWP(iOS/Safari 18.4+): 최상위 web_push:8030 + notification{title,body,navigate,tag}.
//  - 레거시 SW(service-worker.js — 수정 금지): 최상위 title/body/tag/url 을 읽는다.
//    → 최상위 title/body/tag/url 을 그대로 두고, data.url 도 병기(과업 명세).
// clampPayload 는 이 병기 구조 전체를 측정해 2KB 를 넘지 않게 body 를 점진 절단한다.

const MAX_PAYLOAD_BYTES = 2048;
const DWP_VERSION = 8030;
const SAFE_URL = "https://minsubs.github.io/minsubsong/"; // 실배포 앱(안전 기본값)
const APP_HOME_URL = "https://minsubs.github.io/minsubsong/#home"; // 라이브 알림 목적지

// Buffer 가 없는 런타임(Cloudflare Workers) 대비 — Buffer 미존재 시 TextEncoder fallback.
const byteLen =
  typeof Buffer !== "undefined" && typeof Buffer.byteLength === "function"
    ? (s) => Buffer.byteLength(s, "utf8")
    : (s) => new TextEncoder().encode(s).length;

// DWP + SW 병기 구조 조립. extraData 는 SW data 에 병합(예: {event:"score"}).
function assemblePayload({ title, body, url, tag, extraData }) {
  const data = { url, ...(extraData && typeof extraData === "object" ? extraData : {}) };
  return {
    // DWP(Declarative Web Push)
    web_push: DWP_VERSION,
    notification: { title, body, navigate: url, tag },
    // 레거시 SW 호환 필드(병기)
    title,
    body,
    tag,
    url,
    data,
  };
}

// 2KB 보장 — 병기 구조 전체 바이트를 재면서 body 를 점진 절단, 그래도 넘으면 최소형.
function clampPayload({ title, body, url, tag, extraData }) {
  let b = String(body ?? "");
  for (let i = 0; i < 10; i += 1) {
    const candidate = assemblePayload({ title, body: b, url, tag, extraData });
    if (byteLen(JSON.stringify(candidate)) <= MAX_PAYLOAD_BYTES) return candidate;
    if (b.length === 0) break;
    b = b.slice(0, Math.max(0, Math.floor(b.length / 2)));
  }
  // 최소형 — title/tag 축약, body 는 짧게, url 은 안전 기본값.
  return assemblePayload({
    title: String(title ?? "").slice(0, 40) || "KBO TIDO",
    body: String(body ?? "").slice(0, 24) || "알림",
    url: SAFE_URL,
    tag: String(tag ?? "").slice(0, 60) || "kbo-tido-push",
    extraData,
  });
}

export function buildPayload(game) {
  const home = String(game?.home ?? "").slice(0, 20);
  const away = String(game?.away ?? "").slice(0, 20);
  const date = String(game?.date ?? "").slice(0, 10);
  const url = sanitizeUrl(game?.ticketing?.url);

  const matchup = away ? `${home} vs ${away}` : home;
  return clampPayload({
    title: "예매 오픈 임박",
    body: `${date} ${matchup} 예매가 곧 열립니다.`.trim().slice(0, 120),
    url,
    tag: `eagles-ticket-due-${gameIdOf(game)}`.slice(0, 100),
  });
}

function sanitizeUrl(raw) {
  const url = String(raw ?? "").slice(0, 300);
  if (/^https:\/\//.test(url)) return url;
  return SAFE_URL;
}

// ---------------------------------------------------------------------------
// 표시명 헬퍼 — 코드/한글/영문 팀명을 짧은 한국어 표기로
// ---------------------------------------------------------------------------

const TEAM_DISPLAY = {
  HH: "한화", OB: "두산", LG: "LG", SK: "SSG", WO: "키움",
  HT: "KIA", SS: "삼성", LT: "롯데", NC: "NC", KT: "KT",
};

function displayName(name) {
  const raw = String(name ?? "").trim();
  const code = teamCodeOf(raw);
  if (code && TEAM_DISPLAY[code]) return TEAM_DISPLAY[code];
  return raw.slice(0, 12);
}

// KST 시각 라벨 헬퍼 (HH:MM)
function clockLabel(epochMs, tz = "Asia/Seoul") {
  const t = Number(epochMs);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(t));
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

// KST 월/일 라벨 (MM/DD)
function shortDateLabel(epochMs, tz = "Asia/Seoul") {
  const { m, d } = ymdInTimeZone(epochMs, tz);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(m)}/${pad(d)}`;
}

// ---------------------------------------------------------------------------
// F1. 동시오픈 충돌 경보 — endpoint 단위 그룹핑 + 묶음 페이로드
// ---------------------------------------------------------------------------
//
// selectDueSubscriptions 결과를 endpoint(구독) 단위로 묶는다. 한 endpoint 에
// due 가 2건 이상이면 개별 푸시 대신 묶음 1건을 보낸다(buildBundlePayload).
// 정확 동시각이면 서열 없이 "N개 구단 동시 오픈", 시차가 있으면 시각순 나열.

export function groupDueByEndpoint(due) {
  const groups = new Map();
  if (!Array.isArray(due)) return [];
  for (const item of due) {
    const ep = item?.sub?.endpoint;
    if (!ep) continue;
    let g = groups.get(ep);
    if (!g) {
      g = { sub: item.sub, items: [] };
      groups.set(ep, g);
    }
    g.items.push({
      game: item.game,
      topic: item.topic,
      openAt: item.openAt,
      dedupeKey: item.dedupeKey,
    });
  }
  return [...groups.values()];
}

export function buildBundlePayload(items, tz = "Asia/Seoul") {
  const list = Array.isArray(items) ? items.filter((it) => it && it.game) : [];
  if (list.length === 0) return null; // 호출부가 방지(빈 묶음 없음)
  if (list.length === 1) return buildPayload(list[0].game); // 1건은 기존 개별 페이로드

  // openAt 오름차순 — 시차 표기 안정성 + 동시각 판정.
  const sorted = [...list].sort((a, b) => Number(a.openAt) - Number(b.openAt));
  const opens = sorted.map((it) => Number(it.openAt));
  const allSame = opens.every((v) => v === opens[0]);
  const teams = sorted.map((it) => displayName(it.game.home));

  let title;
  let body;
  if (allSame) {
    // 정확 동시각 — 서열 없이 "N개 구단 동시 오픈".
    const hour = hourInTimeZone(opens[0], tz);
    const hourLabel = hour === null ? "" : `${hour}시 `;
    title = "동시 예매 오픈";
    body = `${hourLabel}${teams.length}개 구단 동시 오픈 — ${teams.join("·")}`;
  } else {
    // 시차 — 시각순 나열("11:00 한화 → 14:00 키움").
    title = "예매 오픈 임박";
    body = sorted
      .map((it) => `${clockLabel(it.openAt, tz)} ${displayName(it.game.home)}`)
      .join(" → ");
  }

  const tag = `eagles-ticket-bundle-${sorted.map((it) => it.dedupeKey).join("-")}`.slice(0, 100);
  return clampPayload({
    title,
    body: body.slice(0, 160),
    url: SAFE_URL, // 묶음은 목적지가 여러 개 → 앱 홈으로.
    tag,
  });
}

// ---------------------------------------------------------------------------
// F2. 주간 예매 브리핑 — 일요일 KST 20:00, 다가오는 한 주(월~일) 오픈 요약
// ---------------------------------------------------------------------------
//
// 설계 조정(보고 참조): "이번 주(월~일)"를 다가오는 한 주로 해석한다. 일요일 저녁
// 발송 시 이미 지난 이번 달력주가 아니라 내일(월)부터 시작하는 주의 오픈 일정을
// 요약해야 정보 가치가 있다(§정통망법 야간창 회피로 20:00 확정). 주 경계는 월요일 고정.

function weekdayInTimeZone(epochMs, tz = "Asia/Seoul") {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .formatToParts(new Date(Number(epochMs)))
    .find((p) => p.type === "weekday")?.value;
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[w] ?? null;
}

function ymdInTimeZone(epochMs, tz = "Asia/Seoul") {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Number(epochMs)));
  return {
    y: Number(p.find((x) => x.type === "year")?.value),
    m: Number(p.find((x) => x.type === "month")?.value),
    d: Number(p.find((x) => x.type === "day")?.value),
  };
}

// KST(+09:00, DST 없음) 자정 epoch.
function kstMidnightEpoch(y, m, d) {
  const pad = (n) => String(n).padStart(2, "0");
  return Date.parse(`${y}-${pad(m)}-${pad(d)}T00:00:00+09:00`);
}

// 일요일 KST 20:00~20:59 (분단위 cron 여러 틱 — 청크 발송용 창).
export function isWeeklyBriefWindow(epochMs, tz = "Asia/Seoul") {
  return weekdayInTimeZone(epochMs, tz) === 0 && hourInTimeZone(epochMs, tz) === 20;
}

// 다가오는 월요일 00:00 KST ~ +7일. now 가 일요일이면 weekStart 는 내일(월).
export function upcomingWeekRange(epochMs, tz = "Asia/Seoul") {
  const { y, m, d } = ymdInTimeZone(epochMs, tz);
  const wd = weekdayInTimeZone(epochMs, tz); // 0=Sun..6=Sat
  const base = kstMidnightEpoch(y, m, d);
  let n = (1 - wd + 7) % 7; // 다음 월요일까지 남은 일수
  if (n === 0) n = 7; // 오늘이 월요일이면 다음 주 월요일
  const start = base + n * 86_400_000;
  const end = start + 7 * 86_400_000;
  return { start, end };
}

// ISO 주차 키 "YYYY-Www" — dedup_key(weekly:<ISO주차>) 구성용. (월요일 기준)
export function isoWeekKey(epochMs, tz = "Asia/Seoul") {
  const { y, m, d } = ymdInTimeZone(epochMs, tz);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // 해당 주 목요일로
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

// 다가오는 주에 오픈되는(=openAt 이 주 범위 내) 경기를 팀코드 집합으로 필터·정렬.
export function collectWeeklyOpens({ games, codes, weekStart, weekEnd, year }) {
  const codeSet = codes instanceof Set ? codes : new Set(codes || []);
  const out = [];
  if (!Array.isArray(games)) return out;
  const start = Number(weekStart);
  const end = Number(weekEnd);
  for (const game of games) {
    const code = teamCodeOf(game?.home);
    if (!code) continue;
    if (codeSet.size && !codeSet.has(code)) continue;
    const openAt = deriveOpenAt(game, year);
    if (openAt === null) continue;
    if (openAt < start || openAt >= end) continue;
    out.push({ game, code, openAt });
  }
  out.sort((a, b) => a.openAt - b.openAt);
  return out;
}

// 구독의 weekly_brief 토픽에서 팀코드 집합 추출.
export function weeklyBriefCodes(sub) {
  const topics = Array.isArray(sub?.topics) ? sub.topics : [];
  const set = new Set();
  for (const t of topics) {
    if (typeof t !== "string") continue;
    const mt = t.match(/^([A-Z]{2}):weekly_brief$/);
    if (mt) set.add(mt[1]);
  }
  return set;
}

// 일정 정보만 — 광고성 문구/외부 링크 금지, 앱 URL 만.
export function buildWeeklyBriefPayload({ opens, isoWeek, tz = "Asia/Seoul" }) {
  const list = Array.isArray(opens) ? opens : [];
  const lines = list.slice(0, 6).map(
    (o) => `${shortDateLabel(o.openAt, tz)} ${displayName(o.game.home)} ${clockLabel(o.openAt, tz)}`,
  );
  const more = list.length > 6 ? ` 외 ${list.length - 6}건` : "";
  const body = (lines.join(", ") + more) || "이번 주 예매 오픈 일정";
  return clampPayload({
    title: "이번 주 예매 오픈 일정",
    body: body.slice(0, 180),
    url: SAFE_URL,
    tag: `kbo-weekly-${isoWeek}`.slice(0, 100),
  });
}

// ---------------------------------------------------------------------------
// F3. 재편성(더블헤더) 발표 감지 — calendar_seen diff
// ---------------------------------------------------------------------------
//
// 캘린더에 "새로 나타난" 경기(직전까지 안 보였는데 지금 등장) 중 경기일이 가까운
// 항목을 재편성 후보로 본다. calendar_seen 이 비어있는 최초 실행(cold start)은
// 전 경기를 기록만 하고 후보를 만들지 않는다(전체 신규 오판 금지).

// 경기일(KST 자정) epoch — date "MM.DD" + year.
export function gameDateEpochMs(game, year) {
  const md = String(game?.date ?? "").match(/^(\d{2})\.(\d{2})$/);
  if (!md) return null;
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  const t = kstMidnightEpoch(y, Number(md[1]), Number(md[2]));
  return Number.isNaN(t) ? null : t;
}

export function detectReschedules({ seenIds, calendar, now, year, horizonDays = 10 }) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  const coldStart = seen.size === 0;
  const currentIds = [];
  const newIds = [];
  const candidates = [];
  if (!Array.isArray(calendar)) return { currentIds, newIds, candidates, coldStart };

  const nowMs = Number(now);
  const horizonMs = Number(horizonDays) * 86_400_000;
  const oneDay = 86_400_000;

  for (const game of calendar) {
    const id = gameIdOf(game);
    if (!id) continue;
    currentIds.push(id);
    if (seen.has(id)) continue;
    newIds.push(id); // 신규(직전까지 미출현) — first_seen 을 지금으로 기록할 대상
    if (coldStart) continue; // 콜드스타트 — 기록만, 후보 없음
    const dayMs = gameDateEpochMs(game, year);
    if (dayMs === null) continue;
    // 경기일이 가까운 신규 항목만 재편성 후보(먼 미래 편성 추가는 정상 → 제외).
    if (dayMs < nowMs - oneDay || dayMs > nowMs + horizonMs) continue;
    candidates.push({ game, id });
  }
  return { currentIds, newIds, candidates, coldStart };
}

export function buildReschedulePayload(game) {
  const home = displayName(game?.home);
  const away = displayName(game?.away);
  const date = String(game?.date ?? "").slice(0, 10);
  const matchup = away ? `${home} vs ${away}` : home;
  return clampPayload({
    title: "재편성 발표",
    body: `${date} ${matchup} 재편성 발표 — 예매 일정 확인`.trim().slice(0, 120),
    url: SAFE_URL,
    tag: `kbo-resched-${gameIdOf(game)}`.slice(0, 100),
  });
}

// ---------------------------------------------------------------------------
// F4. LV2 라이브 경기 알림 — 스코어보드 상태 diff (LIVE_ALERTS_DESIGN §2 LV2)
// ---------------------------------------------------------------------------
//
// LV0 실측 의미론(방어적):
//   - 경기 전: state = 시작시각 문자열("18:30" 형식) & 점수 null.
//   - 종료: state = "FINAL".
//   - 진행중: 그 외(미인식) 표기 = 진행중으로 간주(7/16 재확인 예정).
// 취소는 상태 문자열이 없다 → diff 판정(일정에 있는데 스코어보드 미출현/소실).

// 카테고리 인지형 조용한 시간. game_live 는 경기일 23:30 까지 예외(DL2),
// 그 외(ticket_open 등)는 기존 isQuietHour(22:00~08:00) 그대로 — 불변.
export function isQuietHourForCategory(epochMs, category, tz = "Asia/Seoul") {
  if (category === "game_live") {
    const mins = minutesOfDayInTimeZone(epochMs, tz);
    if (mins === null) return false;
    // 08:00 미만 또는 23:30 초과면 조용한 시간(발송 금지).
    return mins < 8 * 60 || mins > 23 * 60 + 30;
  }
  return isQuietHour(epochMs, tz);
}

function minutesOfDayInTimeZone(epochMs, tz) {
  const t = Number(epochMs);
  if (!Number.isFinite(t)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(t));
  const hh = Number(parts.find((p) => p.type === "hour")?.value);
  const mm = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return (hh % 24) * 60 + mm;
}

// 스코어보드 항목의 경기 단계 판정(방어적 의미론).
export function livePhaseOf(game) {
  const s = String(game?.state ?? "").trim();
  const hs = game?.homeScore;
  const as = game?.awayScore;
  const hasScore = (hs !== null && hs !== undefined) || (as !== null && as !== undefined);
  if (/^final$/i.test(s)) return "final";
  if (/^\d{1,2}:\d{2}$/.test(s)) return hasScore ? "live" : "pre"; // 시작시각 표기
  if (s === "" && !hasScore) return "pre"; // 완전 공백 + 점수 없음 → 경기 전(방어)
  return "live"; // 미인식 표기 = 진행중(방어)
}

// KST 날짜 문자열 "YYYY-MM-DD" — 경기 키/창 계산용.
export function kstDateStr(epochMs, tz = "Asia/Seoul") {
  const { y, m, d } = ymdInTimeZone(epochMs, tz);
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

// 경기 안정 키 — away/home 팀코드 + 오늘(KST) 날짜. 스코어보드(영문)·일정(한글)
// 어느 쪽이든 teamCodeOf 로 코드 환산해 동일 키를 얻는다.
function liveGameKey(game, dayStr) {
  const home = teamCodeOf(game?.home ?? game?.homeTeam) ?? String(game?.home ?? game?.homeTeam ?? "").trim();
  const away = teamCodeOf(game?.away ?? game?.awayTeam) ?? String(game?.away ?? game?.awayTeam ?? "").trim();
  return `${dayStr}:${away}@${home}`;
}

// 일정(live-game.json) 항목의 시작 시각 epoch — time "요일 HH:MM" 또는 rawTime.
export function scheduleStartAt(game, dayStr) {
  const raw = String(game?.rawTime ?? game?.time ?? game?.state ?? "");
  const tm = raw.match(/(\d{1,2}):(\d{2})/);
  if (!tm) return null;
  const t = Date.parse(`${dayStr}T${String(tm[1]).padStart(2, "0")}:${tm[2]}:00+09:00`);
  return Number.isNaN(t) ? null : t;
}

// 라이브 모니터 창: 첫 경기 시작 20분 전 ~ 23:30(KST). startAts 는 epoch 배열.
export function isLiveWindow(startAts, now, tz = "Asia/Seoul") {
  const list = (Array.isArray(startAts) ? startAts : []).filter((x) => Number.isFinite(x));
  if (list.length === 0) return false;
  const nowMs = Number(now);
  const first = Math.min(...list);
  const windowStart = first - 20 * 60_000;
  const mins = minutesOfDayInTimeZone(nowMs, tz);
  const before2330 = mins !== null && mins <= 23 * 60 + 30;
  return nowMs >= windowStart && before2330;
}

// 이벤트 판정 순수 함수. current=스코어보드 배열, schedule=오늘 일정 배열(startAt 포함
// 가능), prevStates=live_state 행 배열. 반환 { events, upserts }.
export function detectLiveEvents({ current, schedule, prevStates, now, options = {} }) {
  const dayStr = options.dayStr ?? kstDateStr(now);
  const graceMs = (options.graceMinutes ?? 20) * 60_000;
  const missingThreshold = options.missingThreshold ?? 2;
  const nowMs = Number(now);

  const curMap = indexByKey(current, dayStr);
  const schedMap = indexByKey(schedule, dayStr);
  const prevMap = new Map();
  for (const row of Array.isArray(prevStates) ? prevStates : []) {
    if (row && row.game_key) prevMap.set(row.game_key, row);
  }

  const events = [];
  const upserts = [];
  const allKeys = new Set([...curMap.keys(), ...schedMap.keys(), ...prevMap.keys()]);

  for (const key of allKeys) {
    const cur = curMap.get(key);
    const sched = schedMap.get(key);
    const prev = prevMap.get(key);
    const homeCode = teamCodeOf(cur?.home ?? sched?.home ?? sched?.homeTeam);
    const awayCode = teamCodeOf(cur?.away ?? sched?.away ?? sched?.awayTeam);
    const prevPhase = prev
      ? livePhaseOf({ state: prev.state, homeScore: prev.home_score, awayScore: prev.away_score })
      : null;

    if (cur) {
      // ── 스코어보드에 출현 중 ─────────────────────────────────────────────
      const curPhase = livePhaseOf(cur);
      const hs = numOrNull(cur.homeScore);
      const as = numOrNull(cur.awayScore);
      const meta = { key, homeCode, awayCode, home: cur.home, away: cur.away, homeScore: hs, awayScore: as, state: String(cur.state ?? ""), location: cur.location ?? "" };
      let endedThisTick = false;

      // end: 진행중/경기전 → FINAL 전이.
      if (curPhase === "final" && prevPhase !== "final") {
        events.push({ ...meta, type: "end", targetCodes: dedupeCodes(homeCode, awayCode), dedupKey: `live:${key}:end` });
        endedThisTick = true;
      }
      // start: 경기전 → 진행중 전이(직전 관측이 pre 였을 때만 — 오탐 방지).
      if (!endedThisTick && prevPhase === "pre" && curPhase === "live") {
        events.push({ ...meta, type: "start", targetCodes: dedupeCodes(homeCode, awayCode), dedupKey: `live:${key}:start` });
      }
      // score: 이전에 수치 점수가 있었고 그 값이 증가한 팀 구독자에게만(DL1: 마이팀 득점).
      if (!endedThisTick && prev) {
        const ph = numOrNull(prev.home_score);
        const pa = numOrNull(prev.away_score);
        if (homeCode && ph !== null && hs !== null && hs > ph) {
          events.push({ ...meta, type: "score", scoredCode: homeCode, targetCodes: [homeCode], dedupKey: `live:${key}:score:${hs}-${as}` });
        }
        if (awayCode && pa !== null && as !== null && as > pa) {
          events.push({ ...meta, type: "score", scoredCode: awayCode, targetCodes: [awayCode], dedupKey: `live:${key}:score:${hs}-${as}` });
        }
      }
      // delayed: 진행중 표기 실측(7/16) 전까지 구현 보류 — 자리만 남김.
      //   TODO(delayed): 상태 플래핑 대비 경기당 1회 캡 후 재개 알림은 백로그.

      upserts.push({ game_key: key, home_score: hs, away_score: as, state: meta.state, missing_count: 0, updated_at: nowMs });
    } else {
      // ── 스코어보드 미출현(취소 diff 후보) ────────────────────────────────
      if (prevPhase === "final") continue; // 종료 후 목록에서 빠진 것은 정상.
      const startAt = Number.isFinite(sched?.startAt)
        ? sched.startAt
        : scheduleStartAt(sched ?? {}, dayStr);
      const wasLive = prevPhase === "live";
      const pastGrace = startAt !== null && nowMs >= startAt + graceMs;
      const suspicious = wasLive || pastGrace; // (b)진행중 소실 or (a)시작+유예 후 미출현
      if (!suspicious) continue; // 아직 의심 아님 — 상태 기록 불필요.

      const missing = (numOrNull(prev?.missing_count) ?? 0) + 1;
      if (missing >= missingThreshold) {
        events.push({
          key, homeCode, awayCode,
          home: sched?.home ?? sched?.homeTeam ?? prev?.home ?? "",
          away: sched?.away ?? sched?.awayTeam ?? prev?.away ?? "",
          location: sched?.location ?? "",
          type: "canceled",
          targetCodes: dedupeCodes(homeCode, awayCode),
          dedupKey: `live:${key}:canceled`,
        });
      }
      upserts.push({
        game_key: key,
        home_score: numOrNull(prev?.home_score),
        away_score: numOrNull(prev?.away_score),
        state: String(prev?.state ?? ""),
        missing_count: missing,
        updated_at: nowMs,
      });
    }
  }
  return { events, upserts };
}

function indexByKey(list, dayStr) {
  const m = new Map();
  for (const g of Array.isArray(list) ? list : []) {
    if (!g) continue;
    m.set(liveGameKey(g, dayStr), g);
  }
  return m;
}

function dedupeCodes(...codes) {
  return [...new Set(codes.filter(Boolean))];
}

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function buildLivePayload(event) {
  const tag = `live-${event?.key ?? ""}`.slice(0, 100);
  const homeD = displayName(event?.home);
  const awayD = displayName(event?.away);
  const loc = String(event?.location ?? "").slice(0, 20);
  const matchup = awayD && homeD ? `${awayD} vs ${homeD}` : homeD || awayD || "경기";

  let title;
  let body;
  if (event?.type === "score") {
    const scorer = displayName(event?.scoredCode);
    const oppCode = event?.scoredCode === event?.homeCode ? event?.awayCode : event?.homeCode;
    const opp = displayName(oppCode);
    const scorerScore = event?.scoredCode === event?.homeCode ? event?.homeScore : event?.awayScore;
    const oppScore = event?.scoredCode === event?.homeCode ? event?.awayScore : event?.homeScore;
    title = `${scorer} 득점! ${scorerScore}:${oppScore}`;
    body = `vs ${opp}${loc ? ` — ${loc}` : ""}`;
  } else if (event?.type === "start") {
    title = `경기 시작 — ${matchup}`;
    body = loc || "경기가 시작됐어요.";
  } else if (event?.type === "end") {
    title = `경기 종료 — ${awayD} ${event?.awayScore}:${event?.homeScore} ${homeD}`;
    body = loc || "경기가 종료됐어요.";
  } else if (event?.type === "canceled") {
    title = `우천취소 — ${matchup}`;
    body = `오늘 ${loc ? `${loc} ` : ""}경기가 취소됐어요. 예매 취소/환불은 예매처 공지 확인`;
  } else {
    title = "경기 알림";
    body = matchup;
  }

  return clampPayload({
    title: title.slice(0, 80),
    body: body.slice(0, 120),
    url: APP_HOME_URL,
    tag,
    extraData: { event: event?.type ?? "live" },
  });
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
