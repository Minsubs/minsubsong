// worker/test/scoreboard.test.mjs
// node --test unit tests for scoreboard.js (pure KBO 스코어보드 HTML 파서).
// No live network / no D1. Run: node --test worker/test/scoreboard.test.mjs
//
// 앱(../scripts/update-data.mjs)에는 raw HTML fixture 가 없어(테스트가 파싱된
// JS 객체만 fixture 로 씀) 이 파일에서 parseScoreboard 가 기대하는 최소 KBO
// 스코어보드 HTML 마크업을 직접 구성한다. 마크업 구조는 update-data.mjs 의
// parseScoreboard/parseScoreboardRows 정규식이 매칭하는 태그/클래스명 그대로.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseScoreboard,
  parseScoreboardRows,
  buildLineScoreFromRows,
  normalizeInningScore,
  emptyLineScore,
  locationToKorean,
  cleanText,
} from "../lib/scoreboard.js";

// ---------------------------------------------------------------------------
// fixture 빌더
// ---------------------------------------------------------------------------

// 이닝별 td 셀 문자열(1~9회 + R/H/E 요약 3칸). values 는 각 이닝 문자열/숫자.
function innings(values) {
  return values.map((value) => `<td>${value}</td>`).join("");
}

// 한 경기(scoreboard_time 블록) HTML 조각을 만든다. 실제 markup 의 핵심
// 구조(team_name/team_score/timer/local_time/tbl_common tbl_scoreboard)만 재현.
function gameBlock({
  away,
  home,
  awayScore,
  homeScore,
  state = "",
  locationCode = "DAEJEON",
  time = "18:30",
  awayInnings = ["0", "1", "0", "0", "1", "0", "1", "0", "0"],
  homeInnings = ["2", "0", "1", "0", "0", "3", "0", "1", "0"],
  includeRows = true,
}) {
  const awayScoreHtml = awayScore === null ? "" : String(awayScore);
  const homeScoreHtml = homeScore === null ? "" : String(homeScore);
  const rows = includeRows
    ? `
      <tr><th>&nbsp;</th><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td><td>R</td><td>H</td><td>E</td></tr>
      <tr><th scope="row">${away}</th>${innings(awayInnings)}<td>${awayScoreHtml || "0"}</td><td>7</td><td>1</td></tr>
      <tr><th scope="row">${home}</th>${innings(homeInnings)}<td>${homeScoreHtml || "0"}</td><td>9</td><td>0</td></tr>`
    : "";
  return `
    <span class="team_name">${away}</span>
    <span class="team_score"><span class="num">${awayScoreHtml}</span></span>
    <span class="team_name">${home}</span>
    <span class="team_score"><span class="num">${homeScoreHtml}</span></span>
    <span class="timer"><span class="ico">${state}</span></span>
    <span class="local_time">${locationCode} ${time}</span>
    <div class="tbl_common tbl_scoreboard">
      <table>${rows}</table>
    </div>
    <!--//tbl_common -->`;
}

function boardHtml(blocks) {
  return blocks.map((block) => `<div class="scoreboard_time">${block}</div>`).join("\n");
}

// ---------------------------------------------------------------------------
// 1) 정상 2경기 — 팀/점수/상태/구장/시각 파싱
// ---------------------------------------------------------------------------

test("parseScoreboard: 정상 2경기 파싱 — 팀명/점수/상태/구장/시각", () => {
  const html = boardHtml([
    gameBlock({ away: "SSG", home: "HANWHA", awayScore: 3, homeScore: 7, state: "TOP 8", locationCode: "DAEJEON", time: "18:30" }),
    gameBlock({ away: "DOOSAN", home: "LG", awayScore: 2, homeScore: 5, state: "FINAL", locationCode: "JAMSIL", time: "17:00" }),
  ]);

  const games = parseScoreboard(html);
  assert.equal(games.length, 2);

  const [g1, g2] = games;
  assert.equal(g1.away, "SSG");
  assert.equal(g1.home, "HANWHA");
  assert.equal(g1.awayScore, 3);
  assert.equal(g1.homeScore, 7);
  assert.equal(g1.state, "TOP 8");
  assert.equal(g1.location, "대전");
  assert.equal(g1.rawTime, "18:30");

  assert.equal(g2.away, "DOOSAN");
  assert.equal(g2.home, "LG");
  assert.equal(g2.state, "FINAL");
  assert.equal(g2.location, "잠실");
  assert.equal(g2.rawTime, "17:00");
});

// ---------------------------------------------------------------------------
// 2) 경기 전 — 점수 칸이 비어 있으면 0이 아니라 null
// ---------------------------------------------------------------------------

test("parseScoreboard: 경기 전 점수 칸이 비어 있으면 null (0으로 오표기하지 않음)", () => {
  const html = boardHtml([
    gameBlock({ away: "KIA", home: "HANWHA", awayScore: null, homeScore: null, state: "", includeRows: false }),
  ]);

  const games = parseScoreboard(html);
  assert.equal(games.length, 1);
  const [game] = games;
  assert.equal(game.awayScore, null);
  assert.equal(game.homeScore, null);
  assert.notEqual(game.awayScore, 0);
  assert.notEqual(game.homeScore, 0);
});

// ---------------------------------------------------------------------------
// 3) 빈 HTML → 빈 배열
// ---------------------------------------------------------------------------

test("parseScoreboard: 빈 HTML → 빈 배열", () => {
  assert.deepEqual(parseScoreboard(""), []);
  assert.deepEqual(parseScoreboard("<html><body>no games today</body></html>"), []);
  assert.deepEqual(parseScoreboard(null), []);
  assert.deepEqual(parseScoreboard(undefined), []);
});

// ---------------------------------------------------------------------------
// 4) 상태 문자열 — timer 스팬 텍스트를 그대로 보존(우천취소/중단 등)
// ---------------------------------------------------------------------------

test("parseScoreboard: 상태(timer) 문자열을 그대로 보존한다", () => {
  const cases = ["우천취소", "경기중단", "FINAL", "BOTTOM 6", ""];
  for (const state of cases) {
    const html = boardHtml([
      gameBlock({ away: "KT", home: "SAMSUNG", awayScore: 1, homeScore: 1, state, locationCode: "DAEGU", time: "19:00" }),
    ]);
    const [game] = parseScoreboard(html);
    assert.equal(game.state, state, `state 문자열이 보존되어야 함: ${JSON.stringify(state)}`);
  }
});

// ---------------------------------------------------------------------------
// 5) 라인스코어 — 9이닝 배열, 팀 행 매칭 실패 시 전부 null
// ---------------------------------------------------------------------------

test("parseScoreboard: 라인스코어는 9이닝 배열이며 각 이닝 away/home 값을 담는다", () => {
  const html = boardHtml([
    gameBlock({
      away: "NC",
      home: "KIWOOM",
      awayScore: 4,
      homeScore: 2,
      state: "FINAL",
      awayInnings: ["1", "0", "0", "1", "0", "2", "0", "0", "0"],
      homeInnings: ["0", "1", "0", "0", "1", "0", "0", "0", "0"],
    }),
  ]);
  const [game] = parseScoreboard(html);
  assert.equal(game.linescore.length, 9);
  assert.deepEqual(
    game.linescore.map((cell) => cell.inning),
    Array.from({ length: 9 }, (_, i) => String(i + 1)),
  );
  assert.equal(game.linescore[0].away, 1);
  assert.equal(game.linescore[0].home, 0);
  assert.equal(game.linescore[5].away, 2);
});

test("parseScoreboardRows/buildLineScoreFromRows: 팀 행이 없으면 전부 null(emptyLineScore)", () => {
  assert.deepEqual(buildLineScoreFromRows(undefined, undefined), emptyLineScore());
  const rows = parseScoreboardRows("<table><tr><th scope=\"row\">LOTTE</th><td>1</td></tr></table>");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].team, "LOTTE");
  // 상대팀 행이 없으므로(homeRow undefined) 전부 null.
  assert.deepEqual(buildLineScoreFromRows(rows[0], undefined), emptyLineScore());
});

// ---------------------------------------------------------------------------
// 보너스: 팀명 파싱 실패 세그먼트는 결과에서 제외된다
// ---------------------------------------------------------------------------

test("parseScoreboard: team_name 스팬이 하나뿐이면(파싱 실패) 해당 세그먼트는 제외", () => {
  const malformed = `<div class="scoreboard_time"><span class="team_name">ONLY_ONE</span></div>`;
  assert.deepEqual(parseScoreboard(malformed), []);
});

// ---------------------------------------------------------------------------
// 보조 헬퍼 단위 검증
// ---------------------------------------------------------------------------

test("normalizeInningScore: '-'/빈값/undefined → null, 숫자 문자열 → number", () => {
  assert.equal(normalizeInningScore(undefined), null);
  assert.equal(normalizeInningScore(null), null);
  assert.equal(normalizeInningScore(""), null);
  assert.equal(normalizeInningScore("-"), null);
  assert.equal(normalizeInningScore("3"), 3);
  assert.equal(normalizeInningScore("0"), 0);
});

test("locationToKorean: 매핑 코드 → 한국어, 미매핑은 원문 그대로", () => {
  assert.equal(locationToKorean("DAEJEON"), "대전");
  assert.equal(locationToKorean("JAMSIL"), "잠실");
  assert.equal(locationToKorean("UNKNOWN_PARK"), "UNKNOWN_PARK");
  assert.equal(locationToKorean(""), "");
});

test("cleanText: 태그/엔티티 제거 + 공백 정규화", () => {
  assert.equal(cleanText("<span>한화&nbsp;이글스</span>"), "한화 이글스");
  assert.equal(cleanText("A<br/>B"), "A B");
  assert.equal(cleanText("  padded   text  "), "padded text");
});
