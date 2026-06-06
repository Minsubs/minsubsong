import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseScore,
  resultLabel,
  normalizeInningScore,
  normalizeStreak,
  streakCaption,
  compareMonthDay,
  locationToKorean,
  toEnglishTeam,
  buildLiveGame,
  buildTicketCalendar,
  collectAllTeamScheduleGames,
} from "../scripts/update-data.mjs";

test("parseScore: 경기 전 빈 값/콜론은 null (0:0 오인 방지)", () => {
  assert.deepEqual(parseScore(""), [null, null]);
  assert.deepEqual(parseScore(":"), [null, null]);
  assert.deepEqual(parseScore(undefined), [null, null]);
  assert.deepEqual(parseScore("3:5"), [3, 5]);
  assert.deepEqual(parseScore("10:13"), [10, 13]);
  assert.deepEqual(parseScore("x:y"), [null, null]);
});

test("resultLabel: 한화 기준 승/패/무, 경기 전", () => {
  assert.equal(resultLabel("HANWHA", "SSG", "5:3"), "승 5:3");
  assert.equal(resultLabel("HANWHA", "SSG", "2:7"), "패 2:7");
  assert.equal(resultLabel("HANWHA", "SSG", "4:4"), "무 4:4");
  // 한화가 홈(away=SSG)일 때도 한화 기준으로 표기한다.
  assert.equal(resultLabel("SSG", "HANWHA", "3:5"), "승 5:3");
  assert.equal(resultLabel("HANWHA", "SSG", ":"), "경기전");
});

test("normalizeInningScore: 빈/대시/숫자아님은 null", () => {
  assert.equal(normalizeInningScore(""), null);
  assert.equal(normalizeInningScore("-"), null);
  assert.equal(normalizeInningScore(null), null);
  assert.equal(normalizeInningScore(undefined), null);
  assert.equal(normalizeInningScore("0"), 0);
  assert.equal(normalizeInningScore("7"), 7);
  assert.equal(normalizeInningScore("x"), null);
});

test("streakCaption / normalizeStreak", () => {
  assert.equal(normalizeStreak("3승"), "3");
  assert.equal(streakCaption("W3"), "3연승");
  assert.equal(streakCaption("L2"), "2연패");
});

test("compareMonthDay: 월.일 정렬", () => {
  assert.ok(compareMonthDay("05.31", "06.01") < 0);
  assert.ok(compareMonthDay("06.10", "06.02") > 0);
  assert.equal(compareMonthDay("06.05", "06.05"), 0);
});

test("locationToKorean / toEnglishTeam 매핑", () => {
  assert.equal(locationToKorean("DAEJEON"), "대전");
  assert.equal(locationToKorean("UNKNOWN"), "UNKNOWN");
  assert.equal(toEnglishTeam("한화"), "HANWHA");
  assert.equal(toEnglishTeam("롯데"), "LOTTE");
});

// --- buildLiveGame 상태 분류 회귀 테스트 (진행 중 경기를 'final'로 오표기하던 버그) ---

function scheduleFixture() {
  return [
    {
      type: "upcoming",
      status: "예정 경기",
      date: "01.01",
      time: "월 18:30",
      rawTime: "18:30",
      location: "대전",
      home: "한화",
      away: "SSG",
      score: "경기전",
      rawScore: ":",
      detail: "한화 홈 경기",
    },
  ];
}

function scoreboardFixture(state) {
  return [
    {
      away: "SSG",
      home: "HANWHA",
      awayScore: 3,
      homeScore: 7,
      state,
      linescore: [],
    },
  ];
}

test("buildLiveGame: state=FINAL 이면 종료(경기 결과)", () => {
  const live = buildLiveGame(scheduleFixture(), scoreboardFixture("FINAL"));
  assert.equal(live.status, "final");
  assert.equal(live.statusLabel, "경기 결과");
  assert.equal(live.state, "종료");
  assert.match(live.note, /결과입니다/);
});

test("buildLiveGame: 점수가 있어도 state가 진행 중이면 live(경기 중) — 결과로 오표기하지 않음", () => {
  const live = buildLiveGame(scheduleFixture(), scoreboardFixture("TOP 8"));
  assert.equal(live.status, "live");
  assert.equal(live.statusLabel, "경기 중");
  assert.equal(live.state, "TOP 8");
  assert.match(live.note, /진행 중/);
  // 진행 중 경기를 '경기 결과'로 표기하면 안 된다(회귀 가드).
  assert.notEqual(live.statusLabel, "경기 결과");
});

test("buildLiveGame: 스코어보드 없으면 예정(scheduled)", () => {
  const live = buildLiveGame(scheduleFixture(), []);
  assert.equal(live.status, "scheduled");
  assert.equal(live.statusLabel, "경기 예정");
  assert.equal(live.awayScore, null);
  assert.equal(live.homeScore, null);
});

test("collectAllTeamScheduleGames fetches every team target instead of omitting teamId", async () => {
  const calls = [];
  const targets = [
    { seasonId: "2026", gameMonth: "06" },
    { seasonId: "2026", gameMonth: "07" },
  ];
  const rowsByTeam = {
    HH: [
      {
        row: [
          { Text: "06.10(수)" },
          { Text: "<b>18:30</b>" },
          { Text: "<span>KT</span><em><span>vs</span></em><span>한화</span>" },
          {},
          {},
          {},
          {},
          { Text: "대전" },
        ],
      },
    ],
    LG: [
      {
        row: [
          { Text: "06.11(목)" },
          { Text: "<b>18:30</b>" },
          { Text: "<span>삼성</span><em><span>vs</span></em><span>LG</span>" },
          {},
          {},
          {},
          {},
          { Text: "잠실" },
        ],
      },
    ],
  };

  const games = await collectAllTeamScheduleGames({
    targets,
    teamIds: ["HH", "LG"],
    fetchScheduleMonth: async (target, teamId) => {
      calls.push(`${target.gameMonth}:${teamId || "EMPTY"}`);
      assert.notEqual(teamId, "", "teamId must never be omitted for all-team calendar collection");
      return { rows: rowsByTeam[teamId] ?? [] };
    },
  });

  assert.deepEqual(calls, ["06:HH", "06:LG", "07:HH", "07:LG"]);
  assert.deepEqual(
    games.map((game) => `${game.date}|${game.away}|${game.home}`),
    ["06.10|KT|한화", "06.11|삼성|LG"],
  );
});

test("buildTicketCalendar returns all-team upcoming games sorted by ticket open time", () => {
  const calendar = buildTicketCalendar([
    {
      type: "upcoming",
      date: "06.20",
      time: "토 18:00",
      rawTime: "18:00",
      location: "잠실",
      home: "두산",
      away: "LG",
      score: "경기전",
      detail: "두산 홈 경기",
    },
    {
      type: "upcoming",
      date: "06.18",
      time: "목 18:30",
      rawTime: "18:30",
      location: "사직",
      home: "롯데",
      away: "한화",
      score: "경기전",
      detail: "롯데 홈 경기",
    },
    {
      type: "recent",
      date: "06.01",
      time: "월 18:30",
      rawTime: "18:30",
      location: "대전",
      home: "한화",
      away: "SSG",
      score: "승 3:1",
      detail: "대전 경기",
    },
  ]);

  assert.deepEqual(
    calendar.map((game) => `${game.home}|${game.date}`),
    ["롯데|06.18", "두산|06.20"],
  );
  assert.ok(calendar.every((game) => !("rawTime" in game)), "public calendar JSON must not expose rawTime");
  assert.equal(calendar[0].ticketing.provider, "롯데 자이언츠");
  assert.equal(calendar[1].ticketing.provider, "NOL 티켓");
});
