import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveOpenAt,
  teamCodeOf,
  selectDueSubscriptions,
  isQuietHour,
  allowByFrequencyCap,
  buildPayload,
  maskEndpoint,
  validateEventBatch,
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
  gameDateEpochMs,
  isQuietHourForCategory,
  livePhaseOf,
  detectLiveEvents,
  buildLivePayload,
  scheduleStartAt,
  isLiveWindow,
  kstDateStr,
} from "../lib/push-logic.js";

// Helper: KST epoch ms for a wall-clock instant expressed in +09:00.
const kst = (iso) => Date.parse(`${iso}+09:00`);
const byteLen = (o) => Buffer.byteLength(JSON.stringify(o), "utf8");

// --- deriveOpenAt ---------------------------------------------------------

test("deriveOpenAt: openDaysBefore 일 전 openTime(KST) epoch ms 를 반환", () => {
  // 경기 06.23, 14일 전 14:00 오픈 → 06.09 14:00 KST
  const game = { date: "06.23", time: "화 18:30", ticketing: { openDaysBefore: 14, openTime: "14:00" } };
  assert.equal(deriveOpenAt(game, 2026), kst("2026-06-09T14:00:00"));
});

test("deriveOpenAt: 7일 전 11:00 (가장 흔한 케이스)", () => {
  const game = { date: "07.15", time: "수 18:30", ticketing: { openDaysBefore: 7, openTime: "11:00" } };
  assert.equal(deriveOpenAt(game, 2026), kst("2026-07-08T11:00:00"));
});

test("deriveOpenAt: 연도경계 — 01.05 경기, 7일 전이면 전년도 12.29 로 롤백", () => {
  // 경기 01.05/2026 의 7일 전 = 2025-12-29 11:00 KST
  const game = { date: "01.05", time: "월 14:00", ticketing: { openDaysBefore: 7, openTime: "11:00" } };
  assert.equal(deriveOpenAt(game, 2026), kst("2025-12-29T11:00:00"));
});

test("deriveOpenAt: 연도경계 — 12.25 경기는 같은 해에 머문다", () => {
  const game = { date: "12.25", time: "금 14:00", ticketing: { openDaysBefore: 5, openTime: "11:00" } };
  assert.equal(deriveOpenAt(game, 2026), kst("2026-12-20T11:00:00"));
});

test("deriveOpenAt: 데이터 부족/형식 오류면 null (fail-closed)", () => {
  assert.equal(deriveOpenAt({ date: "06.23", ticketing: {} }, 2026), null);
  assert.equal(deriveOpenAt({ date: "bad", ticketing: { openDaysBefore: 7, openTime: "11:00" } }, 2026), null);
  assert.equal(deriveOpenAt({ date: "06.23", ticketing: { openDaysBefore: 7, openTime: "xx:yy" } }, 2026), null);
  assert.equal(deriveOpenAt(null, 2026), null);
  assert.equal(deriveOpenAt({ date: "06.23", ticketing: { openDaysBefore: 0, openTime: "11:00" } }, 2026), null);
});

// --- teamCodeOf -----------------------------------------------------------

test("teamCodeOf: 10구단 한글/영문 표기 → 표준 코드", () => {
  assert.equal(teamCodeOf("한화"), "HH");
  assert.equal(teamCodeOf("두산"), "OB");
  assert.equal(teamCodeOf("LG"), "LG");
  assert.equal(teamCodeOf("SSG"), "SK");
  assert.equal(teamCodeOf("키움"), "WO");
  assert.equal(teamCodeOf("KIA"), "HT");
  assert.equal(teamCodeOf("삼성"), "SS");
  assert.equal(teamCodeOf("롯데"), "LT");
  assert.equal(teamCodeOf("NC"), "NC");
  assert.equal(teamCodeOf("KT"), "KT");
});

test("teamCodeOf: 혼합/영문 별칭 흡수", () => {
  assert.equal(teamCodeOf("HANWHA"), "HH");
  assert.equal(teamCodeOf("기아"), "HT");
  assert.equal(teamCodeOf("Doosan"), "OB");
  assert.equal(teamCodeOf("Kiwoom"), "WO");
  assert.equal(teamCodeOf("  롯데  "), "LT");
});

test("teamCodeOf: 이미 코드면 그대로, 미상은 null", () => {
  assert.equal(teamCodeOf("HH"), "HH");
  assert.equal(teamCodeOf("LT"), "LT");
  assert.equal(teamCodeOf("미상팀"), null);
  assert.equal(teamCodeOf(""), null);
  assert.equal(teamCodeOf(null), null);
});

// --- isQuietHour ----------------------------------------------------------

test("isQuietHour: 22:00~08:00 KST 는 조용한 시간", () => {
  assert.equal(isQuietHour(kst("2026-06-19T22:00:00")), true);
  assert.equal(isQuietHour(kst("2026-06-19T23:30:00")), true);
  assert.equal(isQuietHour(kst("2026-06-19T03:00:00")), true);
  assert.equal(isQuietHour(kst("2026-06-19T07:59:00")), true);
});

test("isQuietHour: 08:00~22:00 KST 는 조용한 시간 아님", () => {
  assert.equal(isQuietHour(kst("2026-06-19T08:00:00")), false);
  assert.equal(isQuietHour(kst("2026-06-19T12:00:00")), false);
  assert.equal(isQuietHour(kst("2026-06-19T21:59:00")), false);
});

test("isQuietHour: UTC 입력이라도 KST 로 환산 (경계 무시 방지)", () => {
  // 2026-06-19T13:30:00Z = 22:30 KST → quiet
  assert.equal(isQuietHour(Date.parse("2026-06-19T13:30:00Z")), true);
  // 2026-06-19T05:00:00Z = 14:00 KST → not quiet
  assert.equal(isQuietHour(Date.parse("2026-06-19T05:00:00Z")), false);
});

// --- allowByFrequencyCap --------------------------------------------------

test("allowByFrequencyCap: 같은 경기/토픽 이미 발송이면 차단", () => {
  const sub = { endpoint: "https://push.example/abc" };
  const sentRows = [{ endpoint: "https://push.example/abc", topic: "ticket_open", dedupe_key: "g123" }];
  assert.equal(allowByFrequencyCap(sub, "ticket_open", "g123", sentRows), false);
});

test("allowByFrequencyCap: 발송 이력 없으면 허용", () => {
  const sub = { endpoint: "https://push.example/abc" };
  assert.equal(allowByFrequencyCap(sub, "ticket_open", "g123", []), true);
});

test("allowByFrequencyCap: 다른 경기/토픽/엔드포인트는 독립", () => {
  const sub = { endpoint: "https://push.example/abc" };
  const sentRows = [{ endpoint: "https://push.example/abc", topic: "ticket_open", dedupe_key: "g123" }];
  assert.equal(allowByFrequencyCap(sub, "ticket_open", "g999", sentRows), true);
  assert.equal(allowByFrequencyCap(sub, "game_result", "g123", sentRows), true);
  assert.equal(allowByFrequencyCap({ endpoint: "https://push.example/zzz" }, "ticket_open", "g123", sentRows), true);
});

// --- selectDueSubscriptions ----------------------------------------------

test("selectDueSubscriptions: 임박(lead 이내)+topic매칭+미발송 만 선별", () => {
  const now = kst("2026-06-19T10:50:00");
  const games = [
    // openAt 11:00 → now 10:50, lead 15분 → due (10:45~11:00 윈도우)
    { id: "g1", home: "한화", away: "LG", date: "06.26", time: "금 18:30", ticketing: { openDaysBefore: 7, openTime: "11:00" } },
  ];
  const subs = [
    { endpoint: "https://p/a", topics: ["HH:ticket_open"] }, // 매칭
    { endpoint: "https://p/b", topics: ["LG:ticket_open"] }, // 홈팀 아님
    { endpoint: "https://p/c", topics: ["HH:game_result"] }, // 토픽 다름
  ];
  const due = selectDueSubscriptions({ games, subs, now, leadMinutes: 15, sentSet: new Set() });
  assert.equal(due.length, 1);
  assert.equal(due[0].sub.endpoint, "https://p/a");
  assert.equal(due[0].game.id, "g1");
  assert.equal(due[0].topic, "ticket_open");
});

test("selectDueSubscriptions: 아직 임박 전이면 제외", () => {
  const now = kst("2026-06-19T09:00:00"); // openAt 11:00 까지 2시간
  const games = [
    { id: "g1", home: "한화", date: "06.26", time: "금 18:30", ticketing: { openDaysBefore: 7, openTime: "11:00" } },
  ];
  const subs = [{ endpoint: "https://p/a", topics: ["HH:ticket_open"] }];
  const due = selectDueSubscriptions({ games, subs, now, leadMinutes: 15, sentSet: new Set() });
  assert.equal(due.length, 0);
});

test("selectDueSubscriptions: openAt 이미 지난 경기는 제외 (지각 발송 방지)", () => {
  const now = kst("2026-06-19T11:30:00"); // openAt 11:00 이미 지남
  const games = [
    { id: "g1", home: "한화", date: "06.26", time: "금 18:30", ticketing: { openDaysBefore: 7, openTime: "11:00" } },
  ];
  const subs = [{ endpoint: "https://p/a", topics: ["HH:ticket_open"] }];
  const due = selectDueSubscriptions({ games, subs, now, leadMinutes: 15, sentSet: new Set() });
  assert.equal(due.length, 0);
});

test("selectDueSubscriptions: 이미 발송(sentSet) 이면 제외", () => {
  const now = kst("2026-06-19T10:50:00");
  const games = [
    { id: "g1", home: "한화", date: "06.26", time: "금 18:30", ticketing: { openDaysBefore: 7, openTime: "11:00" } },
  ];
  const subs = [{ endpoint: "https://p/a", topics: ["HH:ticket_open"] }];
  const sentSet = new Set(["https://p/a|ticket_open|g1"]);
  const due = selectDueSubscriptions({ games, subs, now, leadMinutes: 15, sentSet });
  assert.equal(due.length, 0);
});

// --- buildPayload ---------------------------------------------------------

test("buildPayload: title/body/url/tag 포함, 2KB 이하", () => {
  const game = { id: "g1", home: "한화", away: "LG", date: "06.26", time: "금 18:30",
    ticketing: { provider: "티켓링크", url: "https://www.ticketlink.co.kr/sports/137/63" } };
  const payload = buildPayload(game);
  assert.ok(payload.title);
  assert.ok(payload.body);
  assert.ok(payload.url);
  assert.ok(payload.tag);
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  assert.ok(bytes <= 2048, `payload ${bytes} bytes > 2048`);
});

test("buildPayload: tag 는 경기당 고유 (중복 알림 합치기용)", () => {
  const a = buildPayload({ id: "g1", home: "한화", away: "LG", date: "06.26", time: "금 18:30", ticketing: {} });
  const b = buildPayload({ id: "g2", home: "한화", away: "LG", date: "06.27", time: "토 17:00", ticketing: {} });
  assert.notEqual(a.tag, b.tag);
});

test("buildPayload: 비정상적으로 긴 입력도 2KB 로 절단", () => {
  const game = { id: "g1", home: "한화", away: "LG".repeat(5000), date: "06.26", time: "금 18:30",
    ticketing: { provider: "x".repeat(5000), url: "https://e/" + "y".repeat(5000) } };
  const payload = buildPayload(game);
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  assert.ok(bytes <= 2048, `payload ${bytes} bytes > 2048`);
});

// --- maskEndpoint ---------------------------------------------------------

test("maskEndpoint: 평문 endpoint 를 노출하지 않음", () => {
  const ep = "https://fcm.googleapis.com/fcm/send/abcDEF123_secret-token";
  const masked = maskEndpoint(ep);
  assert.equal(masked.includes("secret-token"), false);
  assert.equal(masked.includes("abcDEF123"), false);
  assert.notEqual(masked, ep);
  assert.ok(masked.length > 0);
});

test("maskEndpoint: 같은 입력은 안정적 (디버깅 상관관계용), 다른 입력은 다름", () => {
  const a = maskEndpoint("https://fcm.googleapis.com/fcm/send/AAA");
  const b = maskEndpoint("https://fcm.googleapis.com/fcm/send/AAA");
  const c = maskEndpoint("https://fcm.googleapis.com/fcm/send/BBB");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("maskEndpoint: 빈/비문자열 입력도 throw 없이 처리", () => {
  assert.doesNotThrow(() => maskEndpoint(""));
  assert.doesNotThrow(() => maskEndpoint(null));
  assert.doesNotThrow(() => maskEndpoint(undefined));
});

// --- validateEventBatch ---------------------------------------------------

test("validateEventBatch: 익명 카운트만 — 허용 이벤트명+양의정수 count", () => {
  const body = { events: [
    { name: "app_open", count: 3 },
    { name: "ticket_open_click", count: 1 },
    { name: "team_interest", key: "HH", count: 5 },
  ] };
  const result = validateEventBatch(body);
  assert.equal(result.ok, true);
  assert.equal(result.events.length, 3);
});

test("validateEventBatch: PII/식별자 필드는 거부 또는 제거", () => {
  const body = { events: [
    { name: "app_open", count: 1, ip: "1.2.3.4", userAgent: "x", endpoint: "https://p/a", uuid: "u-1" },
  ] };
  const result = validateEventBatch(body);
  assert.equal(result.ok, true);
  const ev = result.events[0];
  assert.equal("ip" in ev, false);
  assert.equal("userAgent" in ev, false);
  assert.equal("endpoint" in ev, false);
  assert.equal("uuid" in ev, false);
  assert.deepEqual(Object.keys(ev).sort(), ["count", "key", "name"].filter((k) => k in ev).sort());
});

test("validateEventBatch: 미허용 이벤트명/음수/비정수 count 거부", () => {
  assert.equal(validateEventBatch({ events: [{ name: "evil_track", count: 1 }] }).ok, false);
  assert.equal(validateEventBatch({ events: [{ name: "app_open", count: -1 }] }).ok, false);
  assert.equal(validateEventBatch({ events: [{ name: "app_open", count: 1.5 }] }).ok, false);
  assert.equal(validateEventBatch({ events: [{ name: "app_open" }] }).ok, false);
});

test("validateEventBatch: 형식 오류 body 는 ok:false (throw 금지)", () => {
  assert.equal(validateEventBatch(null).ok, false);
  assert.equal(validateEventBatch({}).ok, false);
  assert.equal(validateEventBatch({ events: "nope" }).ok, false);
  assert.equal(validateEventBatch({ events: [] }).ok, false);
});

test("validateEventBatch: count 상한으로 폭주 입력 제한", () => {
  const result = validateEventBatch({ events: [{ name: "app_open", count: 10_000_000 }] });
  // 허용하되 상한 클램프, 또는 거부 — 어느 쪽이든 비현실적 값이 그대로 통과하지 않아야
  if (result.ok) {
    assert.ok(result.events[0].count <= 1000);
  } else {
    assert.equal(result.ok, false);
  }
});

// ==========================================================================
// T2. DWP(Declarative Web Push) + 레거시 SW 겸용 페이로드
// ==========================================================================

test("T2: buildPayload 는 DWP + SW 필드를 병기한다", () => {
  const p = buildPayload({ home: "한화", away: "LG", date: "07.15", ticketing: { url: "https://x/y" } });
  // DWP
  assert.equal(p.web_push, 8030);
  assert.ok(p.notification && typeof p.notification === "object");
  assert.equal(p.notification.title, p.title);
  assert.equal(p.notification.body, p.body);
  assert.equal(p.notification.navigate, p.url);
  assert.equal(p.notification.tag, p.tag);
  // 레거시 SW (service-worker.js 가 읽는 최상위 title/body/tag/url + data.url)
  assert.ok(p.title && p.body && p.tag && p.url);
  assert.equal(p.data.url, p.url);
});

test("T2: 병기 구조를 포함해도 2KB 이하 (개별/묶음/라이브)", () => {
  const single = buildPayload({ home: "한화", away: "LG", date: "07.15", ticketing: { url: "https://e/" + "y".repeat(5000) } });
  assert.ok(byteLen(single) <= 2048, `single ${byteLen(single)}`);
  const bundle = buildBundlePayload([
    { game: { home: "한화" }, openAt: kst("2026-07-31T11:00:00"), dedupeKey: "a".repeat(500) },
    { game: { home: "LG" }, openAt: kst("2026-07-31T11:00:00"), dedupeKey: "b".repeat(500) },
  ]);
  assert.ok(byteLen(bundle) <= 2048, `bundle ${byteLen(bundle)}`);
  const live = buildLivePayload({ type: "canceled", key: "k".repeat(500), home: "한화", away: "LG", location: "잠실".repeat(50), targetCodes: ["HH", "LG"] });
  assert.ok(byteLen(live) <= 2048, `live ${byteLen(live)}`);
});

test("T2: 라이브 페이로드는 data.event 를 병기한다", () => {
  const p = buildLivePayload({ type: "score", key: "2026-07-15:HH@LG", scoredCode: "HH", homeCode: "LG", awayCode: "HH", homeScore: 3, awayScore: 5, location: "잠실" });
  assert.equal(p.web_push, 8030);
  assert.equal(p.data.event, "score");
  assert.equal(p.tag, "live-2026-07-15:HH@LG");
});

// ==========================================================================
// F1. 동시오픈 충돌 경보 — 그룹핑 + 묶음(동시/시차 분기)
// ==========================================================================

test("F1 groupDueByEndpoint: endpoint 단위로 due 를 묶는다", () => {
  const openAt = kst("2026-07-31T11:00:00");
  const due = [
    { sub: { endpoint: "e1" }, game: { home: "한화" }, topic: "ticket_open", openAt, dedupeKey: "HH-07.31" },
    { sub: { endpoint: "e1" }, game: { home: "LG" }, topic: "ticket_open", openAt, dedupeKey: "LG-07.31" },
    { sub: { endpoint: "e2" }, game: { home: "한화" }, topic: "ticket_open", openAt, dedupeKey: "HH-07.31" },
  ];
  const groups = groupDueByEndpoint(due);
  assert.equal(groups.length, 2);
  const e1 = groups.find((g) => g.sub.endpoint === "e1");
  const e2 = groups.find((g) => g.sub.endpoint === "e2");
  assert.equal(e1.items.length, 2);
  assert.equal(e2.items.length, 1);
});

test("F1 buildBundlePayload: 정확 동시각 → 서열 없이 'N개 구단 동시 오픈'", () => {
  const openAt = kst("2026-07-31T20:00:00");
  const p = buildBundlePayload([
    { game: { home: "한화" }, openAt, dedupeKey: "a" },
    { game: { home: "LG" }, openAt, dedupeKey: "b" },
    { game: { home: "삼성" }, openAt, dedupeKey: "c" },
  ]);
  assert.equal(p.notification.body, "20시 3개 구단 동시 오픈 — 한화·LG·삼성");
  assert.ok(!/→/.test(p.body)); // 서열 화살표 없음
});

test("F1 buildBundlePayload: 시차 → 시각순 나열 '11:00 한화 → 14:00 키움'", () => {
  const p = buildBundlePayload([
    { game: { home: "키움" }, openAt: kst("2026-07-31T14:00:00"), dedupeKey: "b" },
    { game: { home: "한화" }, openAt: kst("2026-07-31T11:00:00"), dedupeKey: "a" },
  ]);
  assert.equal(p.body, "11:00 한화 → 14:00 키움"); // openAt 오름차순 정렬
});

test("F1 buildBundlePayload: 1건이면 개별 페이로드(묶음 아님)", () => {
  const p = buildBundlePayload([{ game: { home: "한화", away: "LG", date: "07.31", ticketing: {} }, openAt: kst("2026-07-31T11:00:00"), dedupeKey: "a" }]);
  assert.equal(p.title, "예매 오픈 임박"); // buildPayload 경로
  assert.equal(p.notification.body.includes("동시"), false);
});

// ==========================================================================
// F2. 주간 예매 브리핑 — KST 판정 / 주차 dedup / 0건 스킵
// ==========================================================================

test("F2 isWeeklyBriefWindow: 일요일 20:00~20:59 KST 만 true", () => {
  assert.equal(isWeeklyBriefWindow(kst("2026-07-12T20:00:00")), true); // 일 20:00
  assert.equal(isWeeklyBriefWindow(kst("2026-07-12T20:59:00")), true);
  assert.equal(isWeeklyBriefWindow(kst("2026-07-12T19:59:00")), false); // 일 19:59
  assert.equal(isWeeklyBriefWindow(kst("2026-07-12T21:00:00")), false); // 일 21:00
  assert.equal(isWeeklyBriefWindow(kst("2026-07-13T20:00:00")), false); // 월 20:00
});

test("F2 upcomingWeekRange: 일요일 발송 → weekStart 는 다음 월요일 00:00 KST", () => {
  const { start, end } = upcomingWeekRange(kst("2026-07-12T20:00:00")); // 일 07.12
  assert.equal(start, kst("2026-07-13T00:00:00")); // 월 07.13
  assert.equal(end, kst("2026-07-20T00:00:00")); // 다음 월 07.20 (7일)
});

test("F2 isoWeekKey: 안정적 ISO 주차 키(월요일 기준)", () => {
  // 2026-07-13 은 월요일 → ISO 2026-W29
  assert.equal(isoWeekKey(kst("2026-07-13T00:00:00")), "2026-W29");
  // 같은 ISO 주 안 다른 날은 같은 키 → dedup 보장
  assert.equal(isoWeekKey(kst("2026-07-19T23:00:00")), "2026-W29");
});

test("F2 collectWeeklyOpens: 주 범위 내 오픈만, openAt 오름차순, 0건이면 빈 배열", () => {
  const games = [
    { home: "한화", date: "07.20", ticketing: { openDaysBefore: 7, openTime: "11:00" } }, // openAt 07.13 11:00 (주 안)
    { home: "LG", date: "07.21", ticketing: { openDaysBefore: 7, openTime: "14:00" } }, // openAt 07.14 14:00 (주 안)
    { home: "삼성", date: "07.15", ticketing: { openDaysBefore: 7, openTime: "11:00" } }, // openAt 07.08 (주 전)
  ];
  const { start, end } = upcomingWeekRange(kst("2026-07-12T20:00:00"));
  const opens = collectWeeklyOpens({ games, codes: null, weekStart: start, weekEnd: end, year: 2026 });
  assert.equal(opens.length, 2);
  assert.deepEqual(opens.map((o) => o.code), ["HH", "LG"]); // 시각순
  // 0건 스킵: 주 밖만 있는 경우
  const none = collectWeeklyOpens({ games: [games[2]], codes: null, weekStart: start, weekEnd: end, year: 2026 });
  assert.equal(none.length, 0);
});

test("F2 collectWeeklyOpens: codes 필터로 구독 팀만 포함", () => {
  const games = [
    { home: "한화", date: "07.20", ticketing: { openDaysBefore: 7, openTime: "11:00" } },
    { home: "LG", date: "07.21", ticketing: { openDaysBefore: 7, openTime: "14:00" } },
  ];
  const { start, end } = upcomingWeekRange(kst("2026-07-12T20:00:00"));
  const opens = collectWeeklyOpens({ games, codes: new Set(["HH"]), weekStart: start, weekEnd: end, year: 2026 });
  assert.equal(opens.length, 1);
  assert.equal(opens[0].code, "HH");
});

test("F2 weeklyBriefCodes: 구독 토픽에서 weekly_brief 팀코드만 추출", () => {
  const codes = weeklyBriefCodes({ topics: ["HH:weekly_brief", "LG:ticket_open", "SS:weekly_brief", "HH:game_live"] });
  assert.deepEqual([...codes].sort(), ["HH", "SS"]);
});

test("F2 buildWeeklyBriefPayload: 일정만·앱 URL·광고성 문구 없음", () => {
  const opens = [
    { game: { home: "한화" }, openAt: kst("2026-07-13T11:00:00") },
    { game: { home: "LG" }, openAt: kst("2026-07-14T14:00:00") },
  ];
  const p = buildWeeklyBriefPayload({ opens, isoWeek: "2026-W29" });
  assert.equal(p.url, "https://minsubs.github.io/minsubsong/"); // 앱 URL 만
  assert.ok(p.body.includes("07/13") && p.body.includes("한화"));
  assert.equal(p.web_push, 8030); // DWP 병기
});

// ==========================================================================
// F3. 재편성(더블헤더) 발표 감지 — 콜드스타트 가드 / 신규 감지
// ==========================================================================

test("F3 detectReschedules: 콜드스타트(seen 비어있음)는 전부 기록만, 후보 0", () => {
  const calendar = [
    { home: "한화", away: "LG", date: "07.12", time: "일 17:00" },
    { home: "삼성", away: "KT", date: "07.12", time: "일 14:00" },
  ];
  const r = detectReschedules({ seenIds: [], calendar, now: kst("2026-07-11T15:00:00"), year: 2026 });
  assert.equal(r.coldStart, true);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.newIds.length, 2); // 전부 기록 대상
});

test("F3 detectReschedules: 이미 seen 이면 신규(=미출현→등장)만 후보", () => {
  const calendar = [
    { home: "한화", away: "LG", date: "07.12", time: "일 17:00" }, // 신규 & 가까움 → 후보
    { home: "삼성", away: "KT", date: "07.12", time: "일 14:00" }, // 기존 seen
  ];
  const r = detectReschedules({
    seenIds: [gameIdOf(calendar[1])],
    calendar,
    now: kst("2026-07-11T15:00:00"),
    year: 2026,
  });
  assert.equal(r.coldStart, false);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].game.home, "한화");
});

test("F3 detectReschedules: 먼 미래 신규 편성은 후보 아님(horizon)", () => {
  const calendar = [
    { home: "기존", away: "x", date: "07.12", time: "일 14:00" },
    { home: "한화", away: "LG", date: "09.30", time: "화 18:30" }, // 신규지만 80일 뒤 → 정상 편성
  ];
  const r = detectReschedules({
    seenIds: [gameIdOf(calendar[0])],
    calendar,
    now: kst("2026-07-11T15:00:00"),
    year: 2026,
    horizonDays: 10,
  });
  assert.equal(r.candidates.length, 0);
});

test("F3 gameDateEpochMs / buildReschedulePayload", () => {
  assert.equal(gameDateEpochMs({ date: "07.15" }, 2026), kst("2026-07-15T00:00:00"));
  assert.equal(gameDateEpochMs({ date: "bad" }, 2026), null);
  const p = buildReschedulePayload({ home: "한화", away: "LG", date: "07.15" });
  assert.ok(p.body.includes("재편성"));
  assert.equal(p.web_push, 8030);
});

// ==========================================================================
// F4. LV2 라이브 경기 알림 — 의미론 / 이벤트 판정 / quiet 예외
// ==========================================================================

test("F4 livePhaseOf: 시작시각=pre, FINAL=final, 미인식=live(방어)", () => {
  assert.equal(livePhaseOf({ state: "18:30", homeScore: null, awayScore: null }), "pre");
  assert.equal(livePhaseOf({ state: "FINAL" }), "final");
  assert.equal(livePhaseOf({ state: "final", homeScore: 3, awayScore: 2 }), "final");
  assert.equal(livePhaseOf({ state: "6th", homeScore: 2, awayScore: 1 }), "live"); // 미인식 표기
  assert.equal(livePhaseOf({ state: "18:30", homeScore: 1, awayScore: 0 }), "live"); // 시작시각인데 점수 등장
  assert.equal(livePhaseOf({ state: "", homeScore: null, awayScore: null }), "pre"); // 공백+무점수
});

test("F4 isQuietHourForCategory: game_live 는 23:30까지 예외, 그 밖은 기존 정책", () => {
  // game_live: 22:30 발송 가능(예외), 23:45 금지, 03:00 금지, 20:00 가능
  assert.equal(isQuietHourForCategory(kst("2026-07-12T22:30:00"), "game_live"), false);
  assert.equal(isQuietHourForCategory(kst("2026-07-12T23:30:00"), "game_live"), false);
  assert.equal(isQuietHourForCategory(kst("2026-07-12T23:31:00"), "game_live"), true);
  assert.equal(isQuietHourForCategory(kst("2026-07-12T03:00:00"), "game_live"), true);
  assert.equal(isQuietHourForCategory(kst("2026-07-12T20:00:00"), "game_live"), false);
  // ticket_open 등: 기존 isQuietHour 그대로(22:00~08:00)
  assert.equal(isQuietHourForCategory(kst("2026-07-12T22:30:00"), "ticket_open"), true);
  assert.equal(isQuietHourForCategory(kst("2026-07-12T12:00:00"), "ticket_open"), false);
});

test("F4 isQuietHour(기존) 은 절대 불변 — 22:00~08:00", () => {
  // 기존 계약 재확인(카테고리화가 기존 동작을 바꾸지 않음)
  assert.equal(isQuietHour(kst("2026-07-12T22:00:00")), true);
  assert.equal(isQuietHour(kst("2026-07-12T07:59:00")), true);
  assert.equal(isQuietHour(kst("2026-07-12T12:00:00")), false);
});

test("F4 scheduleStartAt / isLiveWindow", () => {
  const day = "2026-07-15";
  assert.equal(scheduleStartAt({ time: "수 18:30" }, day), kst("2026-07-15T18:30:00"));
  assert.equal(scheduleStartAt({ rawTime: "14:00" }, day), kst("2026-07-15T14:00:00"));
  const starts = [kst("2026-07-15T18:30:00")];
  assert.equal(isLiveWindow(starts, kst("2026-07-15T18:15:00")), true); // -15분(창 안: -20분부터)
  assert.equal(isLiveWindow(starts, kst("2026-07-15T17:00:00")), false); // 창 전
  assert.equal(isLiveWindow(starts, kst("2026-07-15T23:45:00")), false); // 23:30 지남
  assert.equal(isLiveWindow([], kst("2026-07-15T18:15:00")), false); // 경기 없음
});

test("F4 detectLiveEvents start: 경기전→진행중, 홈·원정 발송", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화", time: "수 18:30", location: "잠실" }];
  const prev = [{ game_key: `${day}:HH@LG`, home_score: null, away_score: null, state: "18:30", missing_count: 0 }];
  const current = [{ home: "LG", away: "HANWHA", homeScore: 0, awayScore: 1, state: "6th", location: "JAMSIL" }];
  const { events } = detectLiveEvents({ current, schedule, prevStates: prev, now: kst("2026-07-15T18:35:00"), options: { dayStr: day } });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "start");
  assert.equal(events[0].dedupKey, `live:${day}:HH@LG:start`);
  assert.deepEqual(events[0].targetCodes.sort(), ["HH", "LG"]);
});

test("F4 detectLiveEvents score: 점수 오른 팀 구독자만, dedup score:<h>-<a>", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화" }];
  const prev = [{ game_key: `${day}:HH@LG`, home_score: 0, away_score: 1, state: "6th", missing_count: 0 }];
  const current = [{ home: "LG", away: "HANWHA", homeScore: 2, awayScore: 1, state: "7th" }];
  const { events } = detectLiveEvents({ current, schedule, prevStates: prev, now: kst("2026-07-15T19:00:00"), options: { dayStr: day } });
  const score = events.filter((e) => e.type === "score");
  assert.equal(score.length, 1);
  assert.equal(score[0].scoredCode, "LG"); // 홈(LG) 득점
  assert.deepEqual(score[0].targetCodes, ["LG"]); // 오른 팀만
  assert.equal(score[0].dedupKey, `live:${day}:HH@LG:score:2-1`);
});

test("F4 detectLiveEvents score: null→첫 점수는 start 이지 score 아님(중복 방지)", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화" }];
  const prev = [{ game_key: `${day}:HH@LG`, home_score: null, away_score: null, state: "18:30", missing_count: 0 }];
  const current = [{ home: "LG", away: "HANWHA", homeScore: 0, awayScore: 1, state: "1st" }];
  const { events } = detectLiveEvents({ current, schedule, prevStates: prev, now: kst("2026-07-15T18:40:00"), options: { dayStr: day } });
  assert.equal(events.filter((e) => e.type === "score").length, 0);
  assert.equal(events.filter((e) => e.type === "start").length, 1);
});

test("F4 detectLiveEvents end: FINAL 전이 시 홈·원정 발송(최종 스코어 포함)", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화" }];
  const prev = [{ game_key: `${day}:HH@LG`, home_score: 3, away_score: 5, state: "9th", missing_count: 0 }];
  const current = [{ home: "LG", away: "HANWHA", homeScore: 3, awayScore: 5, state: "FINAL" }];
  const { events } = detectLiveEvents({ current, schedule, prevStates: prev, now: kst("2026-07-15T21:30:00"), options: { dayStr: day } });
  const end = events.find((e) => e.type === "end");
  assert.ok(end);
  assert.equal(end.dedupKey, `live:${day}:HH@LG:end`);
  const p = buildLivePayload(end);
  assert.ok(p.title.includes("5") && p.title.includes("3")); // 최종 스코어
});

test("F4 detectLiveEvents canceled: 시작+유예 후 미출현 연속 2회 확인 후 발송", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화", time: "수 18:30", location: "잠실" }];
  const nowLate = kst("2026-07-15T18:55:00"); // 시작(18:30)+25분

  // 1회차 미출현(prev 없음): missing 0→1, 아직 발송 없음(오탐 가드)
  const r1 = detectLiveEvents({ current: [], schedule, prevStates: [], now: nowLate, options: { dayStr: day } });
  assert.equal(r1.events.length, 0);
  assert.equal(r1.upserts[0].missing_count, 1);

  // 2회차 미출현(prev missing 1): missing→2, canceled 발송
  const r2 = detectLiveEvents({ current: [], schedule, prevStates: r1.upserts.map((u) => ({ ...u })), now: nowLate, options: { dayStr: day } });
  const canceled = r2.events.find((e) => e.type === "canceled");
  assert.ok(canceled);
  assert.equal(canceled.dedupKey, `live:${day}:HH@LG:canceled`);
  assert.deepEqual(canceled.targetCodes.sort(), ["HH", "LG"]);
});

test("F4 detectLiveEvents canceled: 진행중이다 소실(FINAL 없이) → 연속 2회 후 canceled", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화", time: "수 18:30" }];
  const now = kst("2026-07-15T19:30:00");
  const prevLive = [{ game_key: `${day}:HH@LG`, home_score: 2, away_score: 1, state: "5th", missing_count: 1 }];
  const { events, upserts } = detectLiveEvents({ current: [], schedule, prevStates: prevLive, now, options: { dayStr: day } });
  assert.ok(events.find((e) => e.type === "canceled"));
  assert.equal(upserts[0].missing_count, 2);
});

test("F4 detectLiveEvents: 종료 후 목록에서 빠진 것은 취소 아님", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화", time: "수 18:30" }];
  const prevFinal = [{ game_key: `${day}:HH@LG`, home_score: 3, away_score: 5, state: "FINAL", missing_count: 0 }];
  const { events } = detectLiveEvents({ current: [], schedule, prevStates: prevFinal, now: kst("2026-07-15T22:00:00"), options: { dayStr: day } });
  assert.equal(events.length, 0);
});

test("F4 detectLiveEvents: 시작+유예 전 미출현은 의심 아님(발송/기록 없음)", () => {
  const day = "2026-07-15";
  const schedule = [{ homeTeam: "LG", awayTeam: "한화", time: "수 18:30" }];
  const r = detectLiveEvents({ current: [], schedule, prevStates: [], now: kst("2026-07-15T18:35:00"), options: { dayStr: day } });
  assert.equal(r.events.length, 0);
  assert.equal(r.upserts.length, 0);
});

test("F4 buildLivePayload: 이벤트 타입별 title + game_live 는 tag 로 트레이 교체", () => {
  const base = { key: "2026-07-15:HH@LG", homeCode: "LG", awayCode: "HH", home: "LG", away: "HANWHA", location: "잠실" };
  const start = buildLivePayload({ ...base, type: "start", targetCodes: ["HH", "LG"] });
  const canceled = buildLivePayload({ ...base, type: "canceled", targetCodes: ["HH", "LG"] });
  assert.ok(start.title.includes("경기 시작"));
  assert.ok(canceled.title.includes("우천취소"));
  assert.equal(start.tag, canceled.tag); // 같은 경기 → 같은 tag(최신 1건 교체)
  assert.equal(start.tag, "live-2026-07-15:HH@LG");
});

test("F4 kstDateStr", () => {
  assert.equal(kstDateStr(kst("2026-07-15T23:30:00")), "2026-07-15");
  assert.equal(kstDateStr(kst("2026-07-15T00:30:00")), "2026-07-15");
});
