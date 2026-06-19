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
  buildLiveGames,
  buildGames,
  buildTicketCalendar,
  buildLeagueLeaderRankings,
  buildPlayerCards,
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

// --- buildLiveGames: live-game.json 새 계약(오늘 전 구단 경기 배열) + 상태 분류 회귀 ---
// buildLiveGames 는 오늘(KST) 날짜로 필터링하므로 픽스처는 kstMonthDay(0) 사용.

function scheduleFixture() {
  return [
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(0),
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

test("buildLiveGames: 배열 반환, state=FINAL 이면 종료(경기 결과)", () => {
  const lives = buildLiveGames(scheduleFixture(), scoreboardFixture("FINAL"));
  assert.ok(Array.isArray(lives));
  assert.equal(lives.length, 1);
  const [live] = lives;
  assert.equal(live.status, "final");
  assert.equal(live.statusLabel, "경기 결과");
  assert.equal(live.state, "종료");
  assert.equal(live.awayTeam, "SSG");
  assert.equal(live.homeTeam, "한화");
  assert.match(live.note, /결과입니다/);
});

test("buildLiveGames: 점수가 있어도 state가 진행 중이면 live(경기 중) — 결과로 오표기하지 않음", () => {
  const [live] = buildLiveGames(scheduleFixture(), scoreboardFixture("TOP 8"));
  assert.equal(live.status, "live");
  assert.equal(live.statusLabel, "경기 중");
  assert.equal(live.state, "TOP 8");
  assert.match(live.note, /진행 중/);
  // 진행 중 경기를 '경기 결과'로 표기하면 안 된다(회귀 가드).
  assert.notEqual(live.statusLabel, "경기 결과");
});

test("buildLiveGames: 스코어보드 매칭 실패 시 일정 기반 중립 상태(경기 예정)", () => {
  const [live] = buildLiveGames(scheduleFixture(), []);
  assert.equal(live.status, "scheduled");
  assert.equal(live.statusLabel, "경기 예정");
  assert.equal(live.awayScore, null);
  assert.equal(live.homeScore, null);
});

test("buildLiveGames: 오늘 경기가 없으면 빈 배열 []", () => {
  const tomorrowOnly = [{ ...scheduleFixture()[0], date: kstMonthDay(1) }];
  assert.deepEqual(buildLiveGames(tomorrowOnly, []), []);
  assert.deepEqual(buildLiveGames([], []), []);
});

test("buildLiveGames: 전 구단 배열 — 오늘 경기만 시간순 포함, 매칭 경기만 스코어 채움", () => {
  const schedule = [
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(0),
      time: "수 18:30",
      rawTime: "18:30",
      location: "대전",
      home: "한화",
      away: "KIA",
      score: "경기전",
      rawScore: ":",
      detail: "한화 홈 경기",
    },
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(0),
      time: "수 17:00",
      rawTime: "17:00",
      location: "잠실",
      home: "LG",
      away: "두산",
      score: "경기전",
      rawScore: ":",
      detail: "LG 홈 경기",
    },
    // 내일 경기 — 오늘 필터에서 제외되어야 한다.
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(1),
      time: "목 18:30",
      rawTime: "18:30",
      location: "사직",
      home: "롯데",
      away: "삼성",
      score: "경기전",
      rawScore: ":",
      detail: "롯데 홈 경기",
    },
    // 어제 경기 — 제외되어야 한다.
    {
      type: "recent",
      status: "최근 결과",
      date: kstMonthDay(-1),
      time: "화 18:30",
      rawTime: "18:30",
      location: "창원",
      home: "NC",
      away: "KT",
      score: "3:5",
      rawScore: "3:5",
      detail: "창원 경기",
    },
  ];
  // 스코어보드는 영문 팀명 — LG 경기만 진행 중으로 매칭된다.
  const scoreboard = [
    {
      away: "DOOSAN",
      home: "LG",
      awayScore: 2,
      homeScore: 5,
      state: "TOP 8",
      location: "잠실",
      linescore: [{ inning: "1", away: 0, home: 2 }],
    },
  ];

  const lives = buildLiveGames(schedule, scoreboard);
  assert.equal(lives.length, 2);

  // rawTime 정렬: LG(17:00) 가 한화(18:30)보다 먼저.
  const [lgGame, hanwhaGame] = lives;
  assert.equal(lgGame.awayTeam, "두산");
  assert.equal(lgGame.homeTeam, "LG");
  assert.equal(lgGame.status, "live");
  assert.equal(lgGame.statusLabel, "경기 중");
  assert.equal(lgGame.awayScore, 2);
  assert.equal(lgGame.homeScore, 5);
  assert.equal(lgGame.inning, "TOP 8");
  assert.deepEqual(lgGame.linescore, [{ inning: "1", away: 0, home: 2 }]);

  // 매칭 실패한 한화 경기는 일정 기반 중립 상태.
  assert.equal(hanwhaGame.awayTeam, "KIA");
  assert.equal(hanwhaGame.homeTeam, "한화");
  assert.equal(hanwhaGame.statusLabel, "경기 예정");
  assert.equal(hanwhaGame.awayScore, null);
  assert.equal(hanwhaGame.homeScore, null);

  // 내일/어제 경기는 포함되지 않는다.
  assert.ok(lives.every((game) => game.homeTeam !== "롯데" && game.homeTeam !== "NC"));
});

test("buildLiveGame(레거시 폴백): 단일 객체 shape 유지 — allSchedule 실패 시 사용", () => {
  const live = buildLiveGame(scheduleFixture(), scoreboardFixture("FINAL"));
  assert.equal(Array.isArray(live), false);
  assert.equal(live.status, "final");
  assert.equal(live.awayTeam, "SSG");
  assert.equal(live.homeTeam, "한화");
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
  assert.equal(calendar[1].ticketing.url, "https://ticket.interpark.com/Contents/Sports");
});

// --- 전 구단 리그 리더 보드 (한화 전용 → 리그 전체 전환) ---

function leagueHittersFixture() {
  return [
    { rank: 1, name: "강백호", team: "KT", avg: "0.350", games: "60", homeRuns: "12", rbi: "55" },
    { rank: 2, name: "페라자", team: "한화", avg: "0.332", games: "60", homeRuns: "20", rbi: "61" },
    { rank: 3, name: "오스틴", team: "LG", avg: "0.320", games: "58", homeRuns: "18", rbi: "60" },
    { rank: 4, name: "문현빈", team: "한화", avg: "0.290", games: "60", homeRuns: "8", rbi: "40" },
  ];
}

function leaguePitchersFixture() {
  return [
    { rank: 1, name: "류현진", team: "한화", era: "2.97", games: "12", wins: "7", losses: "2", whip: "1.01" },
    { rank: 2, name: "원태인", team: "삼성", era: "2.50", games: "12", wins: "8", losses: "1", whip: "0.95" },
    { rank: 3, name: "곽빈", team: "두산", era: "3.10", games: "11", wins: "6", losses: "3", whip: "1.20" },
    { rank: 4, name: "왕옌청", team: "한화", era: "3.49", games: "10", wins: "5", losses: "3", whip: "1.46" },
  ];
}

test("buildLeagueLeaderRankings: 리그 전체 3그룹(타율/홈런/ERA), 전 구단·정렬·top3·team 포함", () => {
  const groups = buildLeagueLeaderRankings(leagueHittersFixture(), leaguePitchersFixture());

  assert.deepEqual(
    groups.map((group) => `${group.id}|${group.scope}`),
    ["league-avg|리그 전체", "league-hr|리그 전체", "league-era|리그 전체"],
  );
  // 한화 전용 'team-power' 그룹은 더 이상 없어야 한다(회귀 가드).
  assert.ok(groups.every((group) => group.id !== "team-power"));

  const [avg, hr, era] = groups;
  // 타율: 내림차순 top3, 1위는 KT 강백호 — 전 구단이 섞여야 한다.
  assert.deepEqual(
    avg.players.map((p) => `${p.rank}:${p.name}:${p.team}:${p.value}:${p.note}`),
    ["1:강백호:KT:0.350:KT", "2:페라자:한화:0.332:한화", "3:오스틴:LG:0.320:LG"],
  );
  // 홈런: HR 내림차순 top3, 페라자(20)가 1위로 재정렬된다.
  assert.deepEqual(
    hr.players.map((p) => `${p.rank}:${p.name}:${p.value}`),
    ["1:페라자:20 HR", "2:오스틴:18 HR", "3:강백호:12 HR"],
  );
  // 평균자책: ERA 오름차순(낮을수록 좋음) top3, 원태인(2.50)이 1위.
  assert.deepEqual(
    era.players.map((p) => `${p.rank}:${p.name}:${p.team}:${p.value}`),
    ["1:원태인:삼성:2.50", "2:류현진:한화:2.97", "3:곽빈:두산:3.10"],
  );
});

test("buildPlayerCards: 리그 타율 top4 타자 + ERA top4 투수 = 8장, team·note 포함", () => {
  const cards = buildPlayerCards(leagueHittersFixture(), leaguePitchersFixture());
  assert.equal(cards.length, 8);
  assert.deepEqual(cards.filter((c) => c.type === "hitter").map((c) => c.note), [
    "리그 타율 1위",
    "리그 타율 2위",
    "리그 타율 3위",
    "리그 타율 4위",
  ]);
  assert.equal(cards[0].team, "KT");
  const firstPitcher = cards.find((c) => c.type === "pitcher");
  assert.equal(firstPitcher.name, "원태인");
  assert.equal(firstPitcher.note, "리그 평균자책 1위");
  assert.equal(firstPitcher.team, "삼성");
});

// --- buildGames 전 구단 전환 (한화 전용 → 전 구단, 날짜 창으로만 제한) ---

// buildGames 는 모듈 로드 시각의 오늘(KST)을 기준으로 날짜 창을 자르므로
// 픽스처 날짜를 오늘 기준 상대 오프셋으로 만들어 결정적으로 통과시킨다.
function kstMonthDay(offsetDays) {
  const base = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${base}T12:00:00+09:00`);
  date.setDate(date.getDate() + offsetDays);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.month}.${parts.day}`;
}

function allTeamScheduleFixture() {
  return [
    // 한화 최근 결과(과거 2일) — 스코어보드 보강 없이도 파서 스코어 유지.
    {
      type: "recent",
      status: "최근 결과",
      date: kstMonthDay(-2),
      time: "월 18:30",
      rawTime: "18:30",
      location: "대전",
      home: "한화",
      away: "KIA",
      score: "패 4:6",
      rawScore: "6:4",
      detail: "대전 경기",
    },
    // 다른 팀 최근 결과(과거 1일) — 중립 스코어 그대로.
    {
      type: "recent",
      status: "최근 결과",
      date: kstMonthDay(-1),
      time: "화 18:30",
      rawTime: "18:30",
      location: "잠실",
      home: "LG",
      away: "두산",
      score: "5:3",
      rawScore: "5:3",
      detail: "잠실 경기",
    },
    // 다른 팀 예정 경기(향후 2일).
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(2),
      time: "목 18:30",
      rawTime: "18:30",
      location: "사직",
      home: "롯데",
      away: "삼성",
      score: "경기전",
      rawScore: ":",
      detail: "롯데 홈 경기",
    },
    // 또 다른 팀 예정 경기(향후 3일).
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(3),
      time: "금 18:30",
      rawTime: "18:30",
      location: "창원",
      home: "NC",
      away: "KT",
      score: "경기전",
      rawScore: ":",
      detail: "NC 홈 경기",
    },
    // 날짜 창 밖(과거 30일) — 제외되어야 한다.
    {
      type: "recent",
      status: "최근 결과",
      date: kstMonthDay(-30),
      time: "수 18:30",
      rawTime: "18:30",
      location: "문학",
      home: "SSG",
      away: "키움",
      score: "2:1",
      rawScore: "2:1",
      detail: "문학 경기",
    },
    // 날짜 창 밖(향후 30일) — 제외되어야 한다.
    {
      type: "upcoming",
      status: "예정 경기",
      date: kstMonthDay(30),
      time: "토 17:00",
      rawTime: "17:00",
      location: "고척",
      home: "키움",
      away: "SSG",
      score: "경기전",
      rawScore: ":",
      detail: "키움 홈 경기",
    },
  ];
}

test("buildGames: 전 구단 경기를 포함한다(한화 단독 아님, 여러 홈팀)", () => {
  const games = buildGames(allTeamScheduleFixture(), []);
  const homeTeams = new Set(games.map((game) => game.home));

  // 한화 전용이 아니라 여러 홈팀이 섞여야 한다(회귀 가드).
  assert.ok(homeTeams.size >= 3, `여러 홈팀이 포함되어야 함, got ${[...homeTeams].join(",")}`);
  assert.ok(homeTeams.has("LG"));
  assert.ok(homeTeams.has("롯데"));
  assert.ok(homeTeams.has("NC"));
  // 한화 없이도 게임 보드가 비지 않는다(team 제한 가정 제거 확인).
  const noHanwha = buildGames(
    allTeamScheduleFixture().filter((game) => game.home !== "한화" && game.away !== "한화"),
    [],
  );
  assert.ok(noHanwha.length > 0);
  assert.ok(noHanwha.every((game) => game.home !== "한화"));
});

test("buildGames: 날짜 창 밖 경기는 제외한다(최근 7일 / 예정 14일)", () => {
  const games = buildGames(allTeamScheduleFixture(), []);
  // 과거 30일·향후 30일 경기는 창 밖이라 빠진다.
  assert.ok(games.every((game) => !(game.home === "SSG" && game.away === "키움")));
  assert.ok(games.every((game) => !(game.home === "키움" && game.away === "SSG")));
});

test("buildGames: 다른 팀 경기는 중립 스코어를 유지하고 ticketing.venueType 은 홈팀 기준", () => {
  const games = buildGames(allTeamScheduleFixture(), []);
  const lgGame = games.find((game) => game.home === "LG");
  // 한화 관점 승/패/무 라벨이 아니라 파서가 만든 중립 스코어를 보존한다.
  assert.equal(lgGame.score, "5:3");
  // 홈팀(LG)은 한화가 아니므로 venueType 은 "원정".
  assert.equal(lgGame.ticketing.venueType, "원정");
  // 공개 JSON 에 내부 필드 노출 금지.
  assert.ok(games.every((game) => !("rawTime" in game) && !("rawScore" in game)));
});
