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
} from "../lib/push-logic.js";

// --- deriveOpenAt ---------------------------------------------------------

// Helper: KST epoch ms for a wall-clock instant expressed in +09:00.
const kst = (iso) => Date.parse(`${iso}+09:00`);

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
