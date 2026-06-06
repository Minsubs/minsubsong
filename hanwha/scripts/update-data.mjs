import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  KBO_TEAM_IDS,
  fetchKoreanScheduleMonth,
  mergeScheduleMonths,
  parseKoreanScheduleRows,
  scheduleMonthTargets,
} from "./kbo-schedule-api.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");
const CACHE_DIR = join(DATA_DIR, "cache", "raw");

const SOURCES = {
  standings: "https://eng.koreabaseball.com/Standings/TeamStandings.aspx",
  schedule: "https://www.koreabaseball.com/Schedule/Schedule.aspx",
  scoreboard: "https://eng.koreabaseball.com/Schedule/Scoreboard.aspx",
  hitters: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx",
  pitchers: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx",
};

const TEAM_NAMES = {
  HANWHA: "한화",
  SSG: "SSG",
  NC: "NC",
  LG: "LG",
  SAMSUNG: "삼성",
  DOOSAN: "두산",
  KIA: "KIA",
  KT: "KT",
  LOTTE: "롯데",
  KIWOOM: "키움",
};

const TICKET_PROVIDERS = {
  한화: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/63",
    note: "한화 홈 예매",
    openLabel: "홈경기 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  SSG: {
    provider: "SSG 티켓",
    url: "https://ticket.ssg.com/ticket",
    note: "SSG 홈 예매",
    openLabel: "SSG 홈 예매 일정 기준",
    openDaysBefore: 5,
    openTime: "11:00",
  },
  NC: {
    provider: "NC 다이노스",
    url: "https://www.ncdinos.com/",
    note: "NC 홈 예매",
    openLabel: "NC 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  두산: {
    provider: "NOL 티켓",
    url: "https://tickets.interpark.com/contents/sports",
    note: "두산 홈 예매",
    openLabel: "두산 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    earlyOpenLabel: "베어스클럽 10:00",
  },
  롯데: {
    provider: "롯데 자이언츠",
    url: "https://ticket.giantsclub.com/",
    note: "롯데 홈 예매",
    openLabel: "롯데 홈 예매 일정 기준",
    openDaysBefore: 14,
    openTime: "14:00",
    openCaution: "구단 앱 공지 기준 확인",
  },
  KIA: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/58",
    note: "KIA 홈 예매",
    openLabel: "KIA 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  키움: {
    provider: "NOL 티켓",
    url: "https://tickets.interpark.com/contents/sports",
    note: "키움 홈 예매",
    openLabel: "키움 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  LG: {
    provider: "NOL 티켓",
    url: "https://tickets.interpark.com/contents/sports",
    note: "LG 홈 예매",
    openLabel: "LG 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
  },
  KT: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "KT 홈 예매",
    openLabel: "KT 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
  },
  삼성: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "삼성 홈 예매",
    openLabel: "삼성 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
  },
};

const MAX_UPCOMING_GAMES = 10;

const now = new Date();
const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const kstParts = Object.fromEntries(kstFormatter.formatToParts(now).map((part) => [part.type, part.value]));
const kstDate = `${kstParts.year}-${kstParts.month}-${kstParts.day}`;
const todayKey = `${kstParts.month}.${kstParts.day}`;
const updatedAt = `${kstDate} ${kstParts.hour}:${kstParts.minute} KST`;

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  const scheduleTargets = scheduleMonthTargets(kstParts.year, kstParts.month);
  // allSettled 로 받아 한 소스가 죽어도 나머지는 갱신한다. 실패한 섹션은
  // 해당 data/*.json 을 건드리지 않아 직전 스냅샷이 그대로 유지된다.
  const [standingsR, scheduleR, scoreboardR, hittersR, pitchersR, allScheduleR] = await Promise.allSettled([
    fetchSource("standings", SOURCES.standings),
    Promise.all(scheduleTargets.map((target) => fetchScheduleMonth(target))),
    fetchSource("scoreboard", SOURCES.scoreboard),
    fetchSource("hitters", SOURCES.hitters),
    fetchSource("pitchers", SOURCES.pitchers),
    collectAllTeamScheduleGames({ targets: scheduleTargets, fetchScheduleMonth }),
  ]);

  const standingsHtml = settledValue(standingsR, "standings");
  const schedulePayloads = settledValue(scheduleR, "schedule");
  const scoreboardHtml = settledValue(scoreboardR, "scoreboard");
  const hittersHtml = settledValue(hittersR, "hitters");
  const pitchersHtml = settledValue(pitchersR, "pitchers");
  const allSchedule = settledValue(allScheduleR, "schedule-all");

  const { standings = [], standing = null, teamStats = null } =
    safeParse("standings", () => parseStandings(standingsHtml), standingsHtml) ?? {};
  const schedule = safeParse(
    "schedule",
    () => mergeScheduleMonths(schedulePayloads.map((payload) => parseKoreanScheduleRows(payload.rows))),
    schedulePayloads,
  );
  const scoreboard = safeParse("scoreboard", () => parseScoreboard(scoreboardHtml), scoreboardHtml);
  const hitters = safeParse("hitters", () => parseHitters(hittersHtml), hittersHtml);
  const pitchers = safeParse("pitchers", () => parsePitchers(pitchersHtml), pitchersHtml);
  // meta 는 항상 갱신(실행 시각). 데이터 변동이 없으면 CI 가 되돌린다.
  await writeJson("meta.json", buildMeta());

  let wrote = 0;
  if (standing && teamStats) {
    await writeJson("summary.json", buildSummary(standing, teamStats));
    wrote += 1;
  } else {
    console.warn("skip summary.json: 팀 순위/기록 수집 실패 — 기존 스냅샷 유지");
  }
  if (standings.length) {
    await writeJson("team-standings.json", buildTeamStandings(standings));
    wrote += 1;
  } else {
    console.warn("skip team-standings.json: 순위 수집 실패 — 기존 스냅샷 유지");
  }
  if (schedule) {
    // 스코어보드는 보강 데이터라 없으면 빈 배열로 일정만으로 빌드한다.
    await writeJson("games.json", buildGames(schedule, scoreboard ?? []));
    await writeJson("live-game.json", buildLiveGame(schedule, scoreboard ?? []));
    wrote += 2;
  } else {
    console.warn("skip games.json/live-game.json: 일정 수집 실패 — 기존 스냅샷 유지");
  }
  if (hitters && pitchers) {
    await writeJson("player-rankings.json", buildPlayerRankings(hitters, pitchers));
    await writeJson("players.json", buildPlayerCards(hitters, pitchers));
    wrote += 2;
  } else {
    console.warn("skip player-rankings.json/players.json: 선수 기록 수집 실패 — 기존 스냅샷 유지");
  }
  if (allSchedule) {
    await writeJson("ticketing-calendar.json", buildTicketCalendar(allSchedule));
    wrote += 1;
  } else {
    console.warn("skip ticketing-calendar.json: 전 구단 일정 수집 실패 — 기존 스냅샷 유지");
  }

  if (wrote === 0) {
    throw new Error("모든 KBO 소스 수집/파싱에 실패했습니다. 스냅샷을 갱신하지 못했습니다.");
  }

  console.log(`Updated KBO data snapshot at ${updatedAt} (sections written: ${wrote})`);
}

function settledValue(result, name) {
  if (result.status === "fulfilled") {
    return result.value;
  }
  console.warn(`source ${name} 수집 실패: ${result.reason?.message ?? result.reason}`);
  return null;
}

function safeParse(name, fn, input) {
  if (!input) {
    return null;
  }
  try {
    return fn();
  } catch (error) {
    console.warn(`parse ${name} 실패: ${error.message}`);
    return null;
  }
}

const FETCH_TIMEOUT_MS = 15000;
const FETCH_ATTEMPTS = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 지수 백오프 재시도. KBO 서버가 응답을 흘리며 연결을 끊지 않아도
// AbortSignal.timeout 으로 무한 대기를 막는다.
async function withRetry(name, run) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) {
        await delay(attempt * 1000);
      }
    }
  }
  throw lastError;
}

async function fetchSource(name, url) {
  const html = await withRetry(name, async () => {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; EaglesLoungeDataBot/1.0)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`${name} fetch failed: ${response.status}`);
    }

    return response.text();
  });

  await writeFile(join(CACHE_DIR, `${name}.html`), html);
  return html;
}

async function fetchScheduleMonth(target, teamId = "HH") {
  const tag = teamId;
  const payload = await withRetry(`schedule-${tag}-${target.gameMonth}`, () =>
    fetchKoreanScheduleMonth({ ...target, teamId }),
  );
  await writeFile(
    join(CACHE_DIR, `schedule-${tag}-${target.seasonId}-${target.gameMonth}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  return payload;
}

async function collectAllTeamScheduleGames({ targets, teamIds = KBO_TEAM_IDS, fetchScheduleMonth: fetchMonth }) {
  const requests = [];

  for (const target of targets) {
    for (const teamId of teamIds) {
      requests.push({ target, teamId });
    }
  }

  const results = await Promise.allSettled(requests.map(({ target, teamId }) => fetchMonth(target, teamId)));
  const fulfilled = [];

  results.forEach((result, index) => {
    const { target, teamId } = requests[index];
    if (result.status === "fulfilled") {
      fulfilled.push(parseKoreanScheduleRows(result.value.rows, { teamFilter: null }));
      return;
    }

    console.warn(`schedule-${teamId}-${target.gameMonth} 수집 실패: ${result.reason?.message ?? result.reason}`);
  });

  if (!fulfilled.length) {
    throw new Error("전 구단 일정 수집에 모두 실패했습니다.");
  }

  return mergeScheduleMonths(fulfilled);
}

// 10구단 통합 예매 캘린더 — 전 구단 예정 경기를 예매 오픈 시각순으로 정렬한다.
function buildTicketCalendar(allGames) {
  return allGames
    .filter((game) => game.type === "upcoming")
    .map((game) => ({ ...game, ticketing: buildTicketing(game) }))
    .sort(compareTicketOpen)
    .map(({ rawTime, rawScore, ...game }) => game);
}

function compareTicketOpen(left, right) {
  return (
    Number(ticketOpenTimestamp(left)) - Number(ticketOpenTimestamp(right)) ||
    compareMonthDay(left.date, right.date) ||
    String(left.time).localeCompare(String(right.time))
  );
}

function ticketOpenTimestamp(game) {
  const ticketing = buildTicketing(game);
  const gameDate = parseGameDate(game.date, game.rawTime ?? game.time);

  if (!gameDate || !ticketing.openDaysBefore || !ticketing.openTime) {
    return Number.POSITIVE_INFINITY;
  }

  const [hour, minute] = ticketing.openTime.split(":").map((part) => Number(part));
  const openAt = new Date(gameDate);
  openAt.setDate(openAt.getDate() - Number(ticketing.openDaysBefore));
  openAt.setHours(hour, minute, 0, 0);
  return openAt.getTime();
}

function parseGameDate(monthDay, timeText) {
  const [, month, day] = String(monthDay).match(/^(\d{2})\.(\d{2})$/) ?? [];
  const [, hour, minute] = String(timeText).match(/(\d{1,2}):(\d{2})/) ?? [];

  if (!month || !day || !hour || !minute) {
    return null;
  }

  return new Date(`${kstParts.year}-${month}-${day}T${hour.padStart(2, "0")}:${minute}:00+09:00`);
}

function parseStandings(html) {
  const standings = [];
  let standing = null;
  let teamStats = null;

  for (const row of extractRows(html)) {
    const cells = extractCells(row);
    const byTitle = Object.fromEntries(cells.filter((cell) => cell.title).map((cell) => [cell.title, cell.text]));

    if (byTitle.TEAM && byTitle.RK) {
      standings.push(byTitle);
    }

    if (byTitle.TEAM === "HANWHA" && byTitle.RK) {
      standing = byTitle;
    }

    if (byTitle.TEAM === "HANWHA" && byTitle.PK) {
      teamStats = byTitle;
    }
  }

  return { standings, standing, teamStats };
}

function parseHitters(html) {
  return parsePlayerRows(html).filter((player) => player.team === "한화").map((player) => ({
    rank: Number(player.rank),
    name: player.name,
    team: player.team,
    avg: player.stats.HRA_RT,
    games: player.stats.GAME_CN,
    homeRuns: player.stats.HR_CN,
    rbi: player.stats.RBI_CN,
  }));
}

function parsePitchers(html) {
  return parsePlayerRows(html).filter((player) => player.team === "한화").map((player) => ({
    rank: Number(player.rank),
    name: player.name,
    team: player.team,
    era: player.stats.ERA_RT,
    games: player.stats.GAME_CN,
    wins: player.stats.W_CN,
    losses: player.stats.L_CN,
    whip: player.stats.WHIP_RT,
  }));
}

function parseScoreboard(html) {
  return html
    .split(/<div class="scoreboard_time">/i)
    .slice(1)
    .map((segment) => {
      const header = segment.split(/<div class="tbl_common tbl_scoreboard">/i)[0] ?? "";
      const table = segment.match(/<div class="tbl_common tbl_scoreboard">([\s\S]*?)<\/div>\s*<!--\/\/tbl_common -->/i)?.[1] ?? "";
      const teams = [...header.matchAll(/<span class="team_name">([\s\S]*?)<\/span>/gi)].map((match) => cleanText(match[1]));
      const scores = [...header.matchAll(/<span class="team_score"><span[^>]*>([\s\S]*?)<\/span><\/span>/gi)].map((match) => {
        // 경기 전에는 점수 칸이 비어 있다. Number("") === 0 으로 잘못 0:0 이 되지 않게 null 처리한다.
        const text = cleanText(match[1]);
        const value = Number(text);
        return text === "" || !Number.isFinite(value) ? null : value;
      });
      const state = cleanText(header.match(/<span class="timer"><span[^>]*>([\s\S]*?)<\/span><\/span>/i)?.[1] ?? "");
      const locationTimeText = cleanText(segment.match(/<span class="local_time">([\s\S]*?)<\/span>/i)?.[1] ?? "");
      const locationTime = locationTimeText.match(/^(.+)\s+(\d{1,2}:\d{2})$/);
      const away = teams[0];
      const home = teams[1];

      if (!away || !home) {
        return null;
      }

      const rows = parseScoreboardRows(table);
      const awayRow = rows.find((row) => row.team === away);
      const homeRow = rows.find((row) => row.team === home);

      return {
        away,
        home,
        awayScore: Number.isFinite(scores[0]) ? scores[0] : null,
        homeScore: Number.isFinite(scores[1]) ? scores[1] : null,
        state,
        location: locationToKorean(locationTime?.[1] ?? ""),
        rawTime: locationTime?.[2] ?? "",
        linescore: buildLineScoreFromRows(awayRow, homeRow),
      };
    })
    .filter(Boolean);
}

function parseScoreboardRows(table) {
  return extractRows(table)
    .map((row) => {
      const team = cleanText(row.match(/<th[^>]*scope=["']row["'][^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? "");
      const values = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanText(match[1]));

      if (!team || values.length === 0) {
        return null;
      }

      return { team, values };
    })
    .filter(Boolean);
}

function buildLineScoreFromRows(awayRow, homeRow) {
  if (!awayRow || !homeRow) {
    return emptyLineScore();
  }

  return Array.from({ length: 9 }, (_, index) => ({
    inning: String(index + 1),
    away: normalizeInningScore(awayRow.values[index]),
    home: normalizeInningScore(homeRow.values[index]),
  }));
}

function parsePlayerRows(html) {
  return extractRows(html).map((row) => {
    const cells = extractCells(row);

    if (cells.length < 4) {
      return null;
    }

    const stats = {};
    for (const cell of cells) {
      if (cell.dataId) {
        stats[cell.dataId] = cell.text;
      }
    }

    if (!cells[0]?.text || !cells[1]?.text || !cells[2]?.text || Object.keys(stats).length === 0) {
      return null;
    }

    return {
      rank: cells[0].text,
      name: cells[1].text,
      team: cells[2].text,
      stats,
    };
  }).filter(Boolean);
}

function mergeScoreboardGame(game, scoreboard) {
  const scoreboardGame = game.date === todayKey ? scoreboard.find((item) => sameMatchup(item, game)) : null;

  if (!scoreboardGame) {
    return game;
  }

  const hanwhaScore = scoreboardGame.away === "HANWHA" ? scoreboardGame.awayScore : scoreboardGame.homeScore;
  const opponentScore = scoreboardGame.away === "HANWHA" ? scoreboardGame.homeScore : scoreboardGame.awayScore;

  return {
    ...game,
    type: scoreboardGame.awayScore === null || scoreboardGame.homeScore === null ? game.type : "recent",
    status: scoreboardGame.awayScore === null || scoreboardGame.homeScore === null ? game.status : "최근 결과",
    score:
      scoreboardGame.awayScore === null || scoreboardGame.homeScore === null
        ? game.score
        : `${hanwhaScore > opponentScore ? "승" : hanwhaScore < opponentScore ? "패" : "무"} ${hanwhaScore}:${opponentScore}`,
    detail: scoreboardGame.state === "FINAL" ? "KBO 스코어보드 최종" : game.detail,
  };
}

function sameMatchup(left, right) {
  if (!left || !right) {
    return false;
  }

  return left.away === toEnglishTeam(right.away) && left.home === toEnglishTeam(right.home);
}

function includesHanwha(game) {
  return game?.away === "HANWHA" || game?.home === "HANWHA";
}

function buildMeta() {
  return {
    updatedAt,
    note: "KBO 공식 페이지 자동 수집 기반 JSON 스냅샷입니다.",
    sources: [
      { name: "KBO Team Standings", url: SOURCES.standings },
      { name: "KBO Daily Schedule", url: SOURCES.schedule },
      { name: "KBO Scoreboard", url: SOURCES.scoreboard },
      { name: "KBO Player Batting", url: SOURCES.hitters },
      { name: "KBO Player Pitching", url: SOURCES.pitchers },
    ],
  };
}

function buildSummary(standing, teamStats) {
  return [
    { label: "순위", value: `${standing.RK}위`, caption: `${standing.W}승 ${standing.L}패` },
    { label: "팀 타율", value: teamStats.AVG, caption: `KBO ${teamStats.PK}위권` },
    { label: "홈런", value: teamStats.HR, caption: "팀 홈런" },
    { label: "최근 흐름", value: standing.STREAK, caption: streakCaption(standing.STREAK) },
  ];
}

function buildTeamStandings(standings) {
  return standings.map((team) => ({
    rank: team.RK,
    team: TEAM_NAMES[team.TEAM] ?? team.TEAM,
    games: team.GAMES,
    wins: team.W,
    losses: team.L,
    draws: team.D,
    pct: team.PCT,
    gamesBehind: team.GB,
    streak: normalizeStreak(team.STREAK),
    home: team.HOME,
    away: team.AWAY,
    isHanwha: team.TEAM === "HANWHA",
  }));
}

function buildGames(schedule, scoreboard) {
  const recent = schedule.filter((game) => game.type === "recent").slice(-3);
  const upcoming = schedule
    .filter((game) => game.type === "upcoming" && compareMonthDay(game.date, todayKey) >= 0)
    .slice(0, MAX_UPCOMING_GAMES);
  return [...recent, ...upcoming]
    .map((game) => mergeScoreboardGame(game, scoreboard))
    .map((game) => ({ ...game, ticketing: buildTicketing(game) }))
    .map(({ rawTime, rawScore, ...game }) => game);
}

function buildTicketing(game) {
  const provider = TICKET_PROVIDERS[game.home] ?? {
    provider: "홈팀 예매처",
    url: "https://www.koreabaseball.com/Schedule/Schedule.aspx",
    note: "KBO 일정에서 홈팀 예매처 확인",
    openLabel: "홈팀 예매 일정 기준",
  };

  return {
    ...provider,
    venueType: game.home === "한화" ? "홈" : "원정",
  };
}

function buildLiveGame(schedule, scoreboard) {
  const todayGame = schedule.find((game) => game.date === todayKey) ?? schedule.find((game) => game.type === "upcoming") ?? schedule.at(-1);
  const todayScoreboard = scoreboard.find((game) => includesHanwha(game) && sameMatchup(game, todayGame));

  if (!todayGame && !todayScoreboard) {
    return readExistingJson("live-game.json");
  }

  const game = todayScoreboard ?? todayGame;
  const [awayScore, homeScore] = todayScoreboard
    ? [todayScoreboard.awayScore, todayScoreboard.homeScore]
    : parseScore(todayGame.rawScore);
  const hasScore = awayScore !== null && homeScore !== null;
  // 점수가 들어왔다는 것은 '경기 시작'을 뜻할 뿐 '종료'가 아니다.
  // 종료 여부는 스코어보드 state(FINAL)로만 판정하고, 점수가 있으면서 종료가
  // 아니면 진행 중(live)으로 본다. 예전에는 점수만 있으면 무조건 final 로
  // 표기해 8회 진행 중 경기가 '경기 결과'로 잘못 보였다.
  const isFinal = game.state === "FINAL";
  const isLive = hasScore && !isFinal;

  const awayName = TEAM_NAMES[game.away] ?? game.away;
  const homeName = TEAM_NAMES[game.home] ?? game.home;

  let status = "scheduled";
  let statusLabel = "경기 예정";
  if (isFinal) {
    status = "final";
    statusLabel = "경기 결과";
  } else if (isLive) {
    status = "live";
    statusLabel = "경기 중";
  }

  let note;
  if (isFinal) {
    note = `${awayName} ${awayScore}:${homeScore} ${homeName}. KBO 스코어보드 기준 결과입니다.`;
  } else if (isLive) {
    const liveState = game.state ? `${game.state} ` : "";
    note = `${awayName} ${awayScore}:${homeScore} ${homeName}. ${liveState}진행 중입니다.`;
  } else {
    note = `${todayGame.date} ${todayGame.rawTime} ${todayGame.away} vs ${todayGame.home}. 경기 시작 후 스코어가 갱신됩니다.`;
  }

  return {
    date: todayGame?.date ?? todayKey,
    time: todayGame?.time ?? localizeWeekday(game.rawTime ?? "", todayKey),
    location: game.location ?? todayGame.location,
    status,
    statusLabel,
    state: isFinal ? "종료" : isLive ? game.state : "스코어 대기",
    inning: isFinal ? "최종" : isLive ? game.state : "연동 대기",
    awayTeam: awayName,
    homeTeam: homeName,
    awayScore,
    homeScore,
    note,
    linescore: game.linescore ?? emptyLineScore(),
  };
}

function buildPlayerRankings(hitters, pitchers) {
  const topHitters = hitters.slice(0, 3);
  const topPitchers = pitchers.slice(0, 3);
  const powerHitters = [...hitters]
    .sort((a, b) => Number(b.homeRuns) - Number(a.homeRuns))
    .slice(0, 3)
    .map((player, index) => ({
      rank: index + 1,
      name: player.name,
      value: `${player.homeRuns} HR`,
      note: `${player.rbi}타점`,
    }));

  return [
    {
      id: "batting-average",
      title: "타율 리그 순위",
      scope: "타자",
      players: topHitters.map((player) => ({
        rank: player.rank,
        name: player.name,
        value: player.avg,
        note: `리그 ${player.rank}위`,
      })),
    },
    {
      id: "pitching-era",
      title: "평균자책 리그 순위",
      scope: "투수",
      players: topPitchers.map((player) => ({
        rank: player.rank,
        name: player.name,
        value: player.era,
        note: `${player.wins}승 ${player.losses}패 · WHIP ${player.whip}`,
      })),
    },
    {
      id: "team-power",
      title: "한화 장타 지표",
      scope: "팀 내부",
      players: powerHitters,
    },
  ];
}

function buildPlayerCards(hitters, pitchers) {
  const hitterCards = hitters.slice(0, 3).map((player) => ({
    type: "hitter",
    number: player.rank,
    name: player.name,
    role: "타자",
    stats: [
      { label: "AVG", value: player.avg },
      { label: "HR", value: player.homeRuns },
      { label: "RBI", value: player.rbi },
    ],
    note: `KBO 타율 ${player.rank}위`,
  }));

  const pitcher = pitchers[0];
  const pitcherCards = pitcher
    ? [
        {
          type: "pitcher",
          number: pitcher.rank,
          name: pitcher.name,
          role: "투수",
          stats: [
            { label: "ERA", value: pitcher.era },
            { label: "W-L", value: `${pitcher.wins}-${pitcher.losses}` },
            { label: "WHIP", value: pitcher.whip },
          ],
          note: `KBO 평균자책 ${pitcher.rank}위`,
        },
      ]
    : [];

  return [...hitterCards, ...pitcherCards];
}

function extractRows(html) {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function extractCells(row) {
  return [...row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => {
    const attrs = match[1] ?? "";
    return {
      title: getAttr(attrs, "title"),
      className: getAttr(attrs, "class") ?? "",
      dataId: getAttr(attrs, "data-id"),
      text: cleanText(match[2]),
    };
  });
}

function getAttr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"");
}

function localizeWeekday(time, date) {
  const [, month, day] = date.match(/^(\d{2})\.(\d{2})$/) ?? [];
  if (!month || !day) {
    return time;
  }

  const dateObject = new Date(`${kstParts.year}-${month}-${day}T12:00:00+09:00`);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" }).format(dateObject);
  return `${weekday} ${time}`;
}

function parseScore(score) {
  if (!score || score === ":") {
    return [null, null];
  }

  const [away, home] = score.split(":").map((value) => Number(value));
  return [Number.isFinite(away) ? away : null, Number.isFinite(home) ? home : null];
}

function normalizeInningScore(value) {
  if (value === undefined || value === null || value === "" || value === "-") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emptyLineScore() {
  return Array.from({ length: 9 }, (_, index) => ({
    inning: String(index + 1),
    away: null,
    home: null,
  }));
}

function resultLabel(away, home, score) {
  const [awayScore, homeScore] = parseScore(score);
  if (awayScore === null || homeScore === null) {
    return "경기전";
  }

  const hanwhaScore = away === "HANWHA" ? awayScore : homeScore;
  const opponentScore = away === "HANWHA" ? homeScore : awayScore;
  const result = hanwhaScore > opponentScore ? "승" : hanwhaScore < opponentScore ? "패" : "무";
  return `${result} ${hanwhaScore}:${opponentScore}`;
}

function locationToKorean(location) {
  const names = {
    DAEJEON: "대전",
    DAEGU: "대구",
    CHANGWON: "창원",
    JAMSIL: "잠실",
    MUNHAK: "문학",
    GWANGJU: "광주",
    GOCHEOKSKY: "고척",
    SUWON: "수원",
    SAJIK: "사직",
  };
  return names[location] ?? location;
}

function toEnglishTeam(team) {
  const names = {
    한화: "HANWHA",
    SSG: "SSG",
    NC: "NC",
    LG: "LG",
    KIA: "KIA",
    KT: "KT",
    롯데: "LOTTE",
    삼성: "SAMSUNG",
    두산: "DOOSAN",
    키움: "KIWOOM",
  };
  return names[team] ?? team;
}

function streakCaption(streak) {
  const match = normalizeStreak(streak).match(/^([WL])(\d+)/i);
  if (!match) {
    return streak;
  }
  return match[1].toUpperCase() === "W" ? `${match[2]}연승` : `${match[2]}연패`;
}

function normalizeStreak(streak) {
  return String(streak ?? "").replace(/[가-힣]+/g, "");
}

function compareMonthDay(left, right) {
  const leftNumber = Number(left.replace(".", ""));
  const rightNumber = Number(right.replace(".", ""));
  return leftNumber - rightNumber;
}

async function readExistingJson(fileName) {
  return JSON.parse(await readFile(join(DATA_DIR, fileName), "utf8"));
}

async function writeJson(fileName, data) {
  await writeFile(join(DATA_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`);
}

// 직접 실행(node update-data.mjs)일 때만 네트워크 수집을 돈다.
// 테스트에서 import 하면 순수 함수만 쓰고 main 은 실행되지 않는다.
const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  parseStandings,
  parseScoreboard,
  parseHitters,
  parsePitchers,
  buildSummary,
  buildTeamStandings,
  buildGames,
  buildLiveGame,
  buildPlayerRankings,
  buildPlayerCards,
  buildTicketCalendar,
  collectAllTeamScheduleGames,
  mergeScoreboardGame,
  sameMatchup,
  includesHanwha,
  parseScore,
  normalizeInningScore,
  resultLabel,
  streakCaption,
  normalizeStreak,
  compareMonthDay,
  locationToKorean,
  toEnglishTeam,
};
