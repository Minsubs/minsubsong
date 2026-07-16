import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

function declaration(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} declaration must exist`);

  const bodyStart = script.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}`);
}

function constLiteral(name) {
  const re = new RegExp(`const ${name}\\s*=\\s*\\{[\\s\\S]*?\\};`);
  const m = script.match(re);
  assert.ok(m, `${name} const literal must exist`);
  return m[0];
}

test("formatInningLabel 는 영문 스코어보드 표기를 한국어로 환산한다", () => {
  const context = vm.createContext({});
  vm.runInContext(`${declaration("formatInningLabel")} globalThis.f = formatInningLabel;`, context);
  const f = context.f;
  assert.equal(f("TOP 5"), "5회 초");
  assert.equal(f("BOT 12"), "12회 말");
  assert.equal(f("bot 5"), "5회 말"); // 대소문자 무관
  assert.equal(f("FINAL"), "최종");
  assert.equal(f("연동 대기"), "연동 대기"); // 미인식 표기 passthrough
});

test("liveEntryFromScoreboard 는 영문→한국어 팀명 + 상태 3분기 + 점수 null 방어", () => {
  const context = vm.createContext({});
  vm.runInContext(
    `${constLiteral("SCOREBOARD_TEAM_KO")} ${declaration("liveEntryFromScoreboard")} globalThis.g = liveEntryFromScoreboard;`,
    context,
  );
  const g = context.g;

  const final = g({ away: "HANWHA", home: "LG", awayScore: 5, homeScore: 3, state: "FINAL" }, "07.16");
  assert.equal(final.awayTeam, "한화");
  assert.equal(final.homeTeam, "LG");
  assert.equal(final.status, "final");
  assert.equal(final.statusLabel, "경기 종료");

  const live = g({ away: "SSG", home: "KT", awayScore: 2, homeScore: 4, state: "BOT 7" }, "07.16");
  assert.equal(live.status, "live");
  assert.equal(live.statusLabel, "진행 중");
  assert.equal(live.inning, "BOT 7"); // 원문 보존(렌더 시점 환산)

  const scheduled = g({ away: "NC", home: "KIA", awayScore: null, homeScore: null, state: "18:30" }, "07.16");
  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.statusLabel, "경기 예정");
  assert.equal(scheduled.awayScore, null);
});

test("livePollEligible 는 PUSH_API_BASE 빈값이면 게이트 OFF", () => {
  // 소스 게이트가 실제로 존재하는지 regex 로 단언.
  assert.match(script, /function livePollEligible[\s\S]*?if \(!PUSH_API_BASE\) return false;/);

  const context = vm.createContext({});
  vm.runInContext(
    `const PUSH_API_BASE = ""; ${declaration("livePollEligible")} globalThis.r = livePollEligible(Date.now());`,
    context,
  );
  assert.equal(context.r, false);
});

function diffContext() {
  const context = vm.createContext({});
  vm.runInContext(`${declaration("computeLiveEvents")} globalThis.c = computeLiveEvents;`, context);
  return context.c;
}

function entry(away, home, status, awayScore, homeScore) {
  return { awayTeam: away, homeTeam: home, status, awayScore, homeScore };
}
function snap(...entries) {
  return new Map(entries.map((e) => [`${e.awayTeam}@${e.homeTeam}`, e]));
}

test("diff 알림: 콜드스타트는 발화하지 않는다", () => {
  const c = diffContext();
  const games = [entry("한화", "LG", "live", 0, 0)];
  // vm 크로스렐름 배열이라 deepEqual 대신 길이로 단언.
  assert.equal(c(null, games, "한화", new Set()).length, 0);
});

test("diff 알림: scheduled→live 는 1회 발화, 같은 전이 재폴링은 중복 미발화", () => {
  const c = diffContext();
  const fired = new Set();
  const prev = snap(entry("한화", "LG", "scheduled", null, null));
  const now = [entry("한화", "LG", "live", 0, 0)];
  const first = c(prev, now, "한화", fired);
  assert.equal(first.length, 1);
  assert.equal(first[0].type, "start");
  // 동일 전이(scheduled→live)를 재폴링해도 firedKeys 로 중복 방지.
  const second = c(prev, now, "한화", fired);
  assert.equal(second.length, 0);
});

test("diff 알림: 마이팀 득점은 발화, 상대팀 득점은 미발화", () => {
  const c = diffContext();
  const prev = snap(entry("한화", "LG", "live", 1, 2));

  const myScore = c(prev, [entry("한화", "LG", "live", 2, 2)], "한화", new Set());
  assert.equal(myScore.length, 1);
  assert.equal(myScore[0].type, "score");

  const oppScore = c(prev, [entry("한화", "LG", "live", 1, 3)], "한화", new Set());
  assert.equal(oppScore.length, 0);
});

test("diff 알림: 종료(final) 후 점수 정정은 득점 오탐을 내지 않는다", () => {
  const c = diffContext();
  const prev = snap(entry("한화", "LG", "final", 3, 2));
  const events = c(prev, [entry("한화", "LG", "final", 4, 2)], "한화", new Set());
  assert.equal(events.length, 0);
});

test("diff 알림: live→final 종료 발화", () => {
  const c = diffContext();
  const prev = snap(entry("한화", "LG", "live", 5, 3));
  const events = c(prev, [entry("한화", "LG", "final", 5, 3)], "한화", new Set());
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "end");
});

test("끝내기 득점(종료+득점 동시): 종료 알림이 득점에 덮이지 않는다", () => {
  const context = vm.createContext({});
  vm.runInContext(
    `${declaration("computeLiveEvents")} ${declaration("scoreValue")} ${declaration("liveEventMessage")} `
      + `${declaration("liveEventTag")} ${declaration("liveEventNotifications")} `
      + `globalThis.c = computeLiveEvents; globalThis.n = liveEventNotifications;`,
    context,
  );
  const c = context.c;
  const n = context.n;

  // 한화 원정 2:2 live → 3:2 FINAL(끝내기 승): 같은 폴에 end + score 가 함께 발생.
  const prev = snap(entry("한화", "LG", "live", 2, 2));
  const events = c(prev, [entry("한화", "LG", "final", 3, 2)], "한화", new Set());
  assert.equal(events.length, 2);
  // vm 크로스렐름 배열이라 deepEqual 대신 문자열로 단언.
  assert.equal(events.map((e) => e.type).sort().join(","), "end,score");

  const payload = n(events, "한화");
  // 인앱 토스트: 종료 문구가 살아있어야 한다(득점에 덮이지 않음).
  assert.match(payload.toast, /경기 종료 — 한화 3:2 LG/);
  assert.match(payload.toast, /한화 득점! 3:2/);
  // 시스템 알림: 이벤트별 고유 tag → 서로 replace 되지 않는다.
  assert.equal(payload.system.length, 2);
  const tags = payload.system.map((s) => s.tag);
  assert.equal(new Set(tags).size, 2);
  assert.ok(payload.system.some((s) => /경기 종료/.test(s.body)));
});

test("NOTIFY_TOPICS 에 game_live/weekly_brief 토픽이 존재한다", () => {
  assert.match(script, /key:\s*"game_live"/);
  assert.match(script, /key:\s*"weekly_brief"/);
});
