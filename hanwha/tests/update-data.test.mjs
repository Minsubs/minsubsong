import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  buildTicketing,
  buildTicketCalendar,
  buildOpenAt,
  collectAllTeamScheduleGames,
  writeJson,
} from "../scripts/update-data.mjs";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

test("update-data: 제거된 선수 데이터 소스를 호출하거나 출력하지 않는다", async () => {
  const source = await readFile(new URL("../scripts/update-data.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /Record\/Player\/HitterBasic/);
  assert.doesNotMatch(source, /Record\/Player\/PitcherBasic/);
  assert.doesNotMatch(source, /player-rankings\.json/);
  assert.doesNotMatch(source, /players\.json/);
});

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
  assert.equal(calendar[1].ticketing.provider, "NOL(야놀자)"); // 2026-07-24 NOL 통합(두산 공지 140)
  assert.equal(calendar[1].ticketing.url, "https://nol.yanolja.com/ticket/genre/sports/bears");
});

// --- buildOpenAt: 예매 오픈 절대시각 파생 (ISO +09:00, 실패=null) ---

test("buildOpenAt: 한화 홈경기 — 7일 전 11:00 KST, +09:00 ISO", () => {
  // 한화: openDaysBefore 7, openTime 11:00. 06.18 경기 → 06.11 11:00 KST.
  const openAt = buildOpenAt(
    { date: "06.18", rawTime: "18:30", home: "한화" },
    2026,
  );
  assert.equal(openAt, "2026-06-11T11:00:00+09:00");
});

test("buildOpenAt: 롯데 — 14일 전 14:00 KST", () => {
  // 롯데: openDaysBefore 14, openTime 14:00. 06.20 → 06.06 14:00.
  const openAt = buildOpenAt({ date: "06.20", rawTime: "18:00", home: "롯데" }, 2026);
  assert.equal(openAt, "2026-06-06T14:00:00+09:00");
});

test("예매 메타: NC는 자체 채널, KT 일반예매는 7일 전 16:00", () => {
  const nc = buildTicketing({ home: "NC" });
  assert.equal(nc.provider, "NC 다이노스");
  assert.equal(nc.url, "https://www.ncdinos.com/");

  const kt = buildTicketing({ home: "KT" });
  assert.equal(kt.provider, "티켓링크");
  assert.equal(kt.openDaysBefore, 7);
  assert.equal(kt.openTime, "16:00");
  assert.equal(buildOpenAt({ date: "07.21", rawTime: "18:30", home: "KT" }, 2026), "2026-07-14T16:00:00+09:00");
});

test("예매 메타: SSG 공식 판매 일정 기준 4일 전 11:00", () => {
  const ssg = buildTicketing({ home: "SSG" });
  assert.equal(ssg.url, "https://ticket.ssg.com/");
  assert.equal(ssg.openDaysBefore, 4);
  assert.equal(ssg.openTime, "11:00");
  assert.equal(buildOpenAt({ date: "07.26", rawTime: "18:00", home: "SSG" }, 2026), "2026-07-22T11:00:00+09:00");
  assert.equal("verification" in ssg, false, "감사 메타는 public ticketing 계약에 노출하지 않음");
});

test("buildOpenAt: ticketing 미리 주입 시 그대로 사용", () => {
  const openAt = buildOpenAt(
    { date: "07.01", rawTime: "18:30", ticketing: { openDaysBefore: 5, openTime: "11:00" } },
    2026,
  );
  assert.equal(openAt, "2026-06-26T11:00:00+09:00");
});

test("buildOpenAt 연도경계: 01.05 경기는 다음 해, 오픈은 전년 12월로 롤오버", () => {
  // 1월 경기는 meta year(2025)의 다음 해(2026) 경기. 롯데 14일 전 14:00.
  // 2026-01-05 − 14일 = 2025-12-22 14:00 KST.
  const openAt = buildOpenAt({ date: "01.05", rawTime: "14:00", home: "롯데" }, 2025);
  assert.equal(openAt, "2025-12-22T14:00:00+09:00");
});

test("buildOpenAt 연도경계: 12.25 경기는 같은 해, 오픈도 12월 내", () => {
  // 12월 경기는 보정 없음(meta year 그대로). 한화 7일 전 11:00.
  // 2025-12-25 − 7일 = 2025-12-18 11:00 KST.
  const openAt = buildOpenAt({ date: "12.25", rawTime: "18:30", home: "한화" }, 2025);
  assert.equal(openAt, "2025-12-18T11:00:00+09:00");
});

test("buildOpenAt: 파생 불가(날짜/시각/연도 누락)는 null (fail-closed)", () => {
  // 잘못된 date 포맷.
  assert.equal(buildOpenAt({ date: "6.18", rawTime: "18:30", home: "한화" }, 2026), null);
  // openTime/openDaysBefore 없는 예매처(기본 provider — openDaysBefore 미정).
  assert.equal(
    buildOpenAt({ date: "06.18", rawTime: "18:30", ticketing: { openTime: "11:00" } }, 2026),
    null,
  );
  // 연도 NaN.
  assert.equal(buildOpenAt({ date: "06.18", rawTime: "18:30", home: "한화" }, NaN), null);
});

test("buildTicketCalendar: emit한 항목에 top-level openAt(ISO +09:00) 포함", () => {
  const calendar = buildTicketCalendar(
    [
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
    ],
    2026,
  );
  // 두산: openDaysBefore 7, openTime 11:00. 06.20 − 7일 = 06.13 11:00 KST.
  assert.equal(calendar[0].openAt, "2026-06-13T11:00:00+09:00");
  assert.match(calendar[0].openAt, /\+09:00$/);
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

test("writeJson: 동일 내용 재호출 시 파일을 재작성하지 않는다(mtime 불변)", async () => {
  const fileName = "__test-write-json-skip.json";
  const filePath = join(DATA_DIR, fileName);
  const payload = { hello: "world" };

  try {
    await writeJson(fileName, payload);
    const firstStat = await stat(filePath);

    // macOS/Linux 파일시스템 mtime 분해능(수 ms) 안에서도 구분되도록 살짝 대기.
    await new Promise((resolve) => setTimeout(resolve, 20));

    await writeJson(fileName, payload);
    const secondStat = await stat(filePath);

    assert.equal(secondStat.mtimeMs, firstStat.mtimeMs);

    const content = await readFile(filePath, "utf8");
    assert.equal(content, `${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await unlink(filePath).catch(() => {});
  }
});
