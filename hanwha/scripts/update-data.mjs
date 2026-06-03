import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchKoreanScheduleMonth, mergeScheduleMonths, parseKoreanScheduleRows, scheduleMonthTargets } from "./kbo-schedule-api.mjs";

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
  const [standingsHtml, schedulePayloads, scoreboardHtml, hittersHtml, pitchersHtml] = await Promise.all([
    fetchSource("standings", SOURCES.standings),
    Promise.all(scheduleTargets.map((target) => fetchScheduleMonth(target))),
    fetchSource("scoreboard", SOURCES.scoreboard),
    fetchSource("hitters", SOURCES.hitters),
    fetchSource("pitchers", SOURCES.pitchers),
  ]);

  const { standings, standing, teamStats } = parseStandings(standingsHtml);
  const schedule = mergeScheduleMonths(schedulePayloads.map((payload) => parseKoreanScheduleRows(payload.rows)));
  const scoreboard = parseScoreboard(scoreboardHtml);
  const hitters = parseHitters(hittersHtml);
  const pitchers = parsePitchers(pitchersHtml);

  if (!standing || !teamStats) {
    throw new Error("한화 팀 순위 또는 팀 기록을 찾지 못했습니다.");
  }

  await writeJson("meta.json", buildMeta());
  await writeJson("summary.json", buildSummary(standing, teamStats));
  await writeJson("team-standings.json", buildTeamStandings(standings));
  await writeJson("games.json", buildGames(schedule, scoreboard));
  await writeJson("live-game.json", buildLiveGame(schedule, scoreboard));
  await writeJson("player-rankings.json", buildPlayerRankings(hitters, pitchers));
  await writeJson("players.json", buildPlayerCards(hitters, pitchers));

  console.log(`Updated KBO data snapshot at ${updatedAt}`);
}

async function fetchSource(name, url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; EaglesLoungeDataBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`${name} fetch failed: ${response.status}`);
  }

  const html = await response.text();
  await writeFile(join(CACHE_DIR, `${name}.html`), html);
  return html;
}

async function fetchScheduleMonth(target) {
  const payload = await fetchKoreanScheduleMonth(target);
  await writeFile(join(CACHE_DIR, `schedule-${target.seasonId}-${target.gameMonth}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
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

function parseSchedule(html) {
  const games = [];
  let currentDate = "";

  for (const row of extractRows(html)) {
    const cells = extractCells(row);
    const dateCell = cells.find((cell) => cell.title === "DATE");

    if (dateCell) {
      currentDate = dateCell.text.slice(0, 5);
    }

    const time = cells.find((cell) => cell.className.includes("TIME"))?.text;
    const location = cells.find((cell) => cell.className.includes("LOCATION"))?.text;
    const gameCells = cells.filter((cell) => cell.title === "GAME");

    if (!time || gameCells.length < 3) {
      continue;
    }

    const away = gameCells[0].text;
    const score = gameCells[1].text;
    const home = gameCells[2].text;

    if (away !== "HANWHA" && home !== "HANWHA") {
      continue;
    }

    games.push({
      type: score === ":" ? "upcoming" : "recent",
      status: score === ":" ? "예정 경기" : "최근 결과",
      date: currentDate,
      time: localizeWeekday(time, currentDate),
      rawTime: time,
      location: TEAM_NAMES[location] ?? locationToKorean(location),
      home: TEAM_NAMES[home] ?? home,
      away: TEAM_NAMES[away] ?? away,
      score: score === ":" ? "경기전" : resultLabel(away, home, score),
      rawScore: score,
      detail: score === ":" ? `${TEAM_NAMES[home] ?? home} 홈 경기` : `${locationToKorean(location)} 경기`,
    });
  }

  return games;
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

  return {
    date: todayGame?.date ?? todayKey,
    time: todayGame?.time ?? localizeWeekday(game.rawTime ?? "", todayKey),
    location: game.location ?? todayGame.location,
    status: hasScore ? "final" : "scheduled",
    statusLabel: hasScore ? "경기 결과" : "경기 예정",
    state: game.state === "FINAL" ? "종료" : hasScore ? game.state : "스코어 대기",
    inning: game.state === "FINAL" ? "최종" : hasScore ? game.state : "연동 대기",
    awayTeam: TEAM_NAMES[game.away] ?? game.away,
    homeTeam: TEAM_NAMES[game.home] ?? game.home,
    awayScore,
    homeScore,
    note: hasScore
      ? `${TEAM_NAMES[game.away] ?? game.away} ${awayScore}:${homeScore} ${TEAM_NAMES[game.home] ?? game.home}. KBO 스코어보드 기준 결과입니다.`
      : `${todayGame.date} ${todayGame.rawTime} ${todayGame.away} vs ${todayGame.home}. 경기 시작 후 스코어가 갱신됩니다.`,
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
