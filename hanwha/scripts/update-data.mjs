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
    url: "https://ticket.interpark.com/Contents/Sports",
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
    url: "https://ticket.interpark.com/Contents/Sports",
    note: "키움 홈 예매",
    openLabel: "키움 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "14:00",
  },
  LG: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/59",
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

// 전 구단 경기 보드 날짜 창(일). 최근 결과는 과거 RECENT, 예정은 향후 UPCOMING.
const RECENT_WINDOW_DAYS = 7;
const UPCOMING_WINDOW_DAYS = 14;

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
  const [standingsR, scheduleR, scoreboardR, allScheduleR] = await Promise.allSettled([
    fetchSource("standings", SOURCES.standings),
    Promise.all(scheduleTargets.map((target) => fetchScheduleMonth(target))),
    fetchSource("scoreboard", SOURCES.scoreboard),
    collectAllTeamScheduleGames({ targets: scheduleTargets, fetchScheduleMonth }),
  ]);

  const standingsHtml = settledValue(standingsR, "standings");
  const schedulePayloads = settledValue(scheduleR, "schedule");
  const scoreboardHtml = settledValue(scoreboardR, "scoreboard");
  const allSchedule = settledValue(allScheduleR, "schedule-all");

  const { standings = [], standing = null, teamStats = null } =
    safeParse("standings", () => parseStandings(standingsHtml), standingsHtml) ?? {};
  const schedule = safeParse(
    "schedule",
    () => mergeScheduleMonths(schedulePayloads.map((payload) => parseKoreanScheduleRows(payload.rows))),
    schedulePayloads,
  );
  const scoreboard = safeParse("scoreboard", () => parseScoreboard(scoreboardHtml), scoreboardHtml);
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
  if (schedule || allSchedule) {
    // 스코어보드는 보강 데이터라 없으면 빈 배열로 일정만으로 빌드한다.
    // games.json 은 전 구단(allSchedule) 기준. 전 구단 수집이 실패하면 한화
    // 일정(schedule)으로 폴백해 최소한 한화 경기는 유지한다.
    const gamesSchedule = allSchedule ?? schedule;
    if (gamesSchedule) {
      await writeJson("games.json", buildGames(gamesSchedule, scoreboard ?? []));
      wrote += 1;
    }
    // live-game.json 은 오늘(KST) 전 구단 경기 배열(새 계약 shape).
    // allSchedule 수집 실패 시에만 기존 한화 일정 기반 단일 경기 객체로
    // 폴백한다(레거시 shape — UI 가 방어적으로 허용).
    if (allSchedule) {
      await writeJson("live-game.json", buildLiveGames(allSchedule, scoreboard ?? []));
      wrote += 1;
    } else if (schedule) {
      await writeJson("live-game.json", await buildLiveGame(schedule, scoreboard ?? []));
      wrote += 1;
    }
  } else {
    console.warn("skip games.json/live-game.json: 일정 수집 실패 — 기존 스냅샷 유지");
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
// top-level openAt(ISO +09:00)을 emit해 백엔드/클라가 재계산 없이 발송 트리거
// 근거로 쓰게 한다. 파생 실패/NaN 은 fail-closed 로 null.
function buildTicketCalendar(allGames, year = Number(kstParts.year)) {
  return allGames
    .filter((game) => game.type === "upcoming")
    .map((game) => {
      const ticketing = buildTicketing(game);
      return { ...game, ticketing, openAt: buildOpenAt({ ...game, ticketing }, year) };
    })
    .sort(compareTicketOpen)
    .map(({ rawTime, rawScore, ...game }) => game);
}

function compareTicketOpen(left, right) {
  return (
    ticketOpenTimestamp(left) - ticketOpenTimestamp(right) ||
    compareMonthDay(left.date, right.date) ||
    String(left.time).localeCompare(String(right.time))
  );
}

// 정렬용 epoch — openAt(ISO)을 파싱해 ms 로. 없으면 +Infinity(뒤로).
function ticketOpenTimestamp(game) {
  const iso = game.openAt ?? buildOpenAt(game, Number(kstParts.year));
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

// 순수 파생: 예매 오픈 절대시각(ISO, +09:00). 호스트 타임존에 의존하지 않게
// UTC epoch 산술 + 고정 +09:00 오프셋으로 계산한다.
//   openAtKst = gameDate(MM.DD, year) − openDaysBefore일, 시각=openTime("HH:MM")
// Dec-Jan 경계: 1월 경기는 meta(=year, 보통 12월 실행)의 다음 해 경기이므로 year+1
// 로 보정한다. 일(day) 빼기는 epoch 산술이 월/연 경계를 자동 롤오버한다
// (예: 01.05 − 14일 → 전년 12.22). 파생 불가/NaN 이면 null(fail-closed).
function buildOpenAt(game, year) {
  const ticketing = game.ticketing ?? buildTicketing(game);
  const [, month, day] = String(game.date).match(/^(\d{2})\.(\d{2})$/) ?? [];
  const openTime = ticketing?.openTime;
  const openDaysBefore = ticketing?.openDaysBefore;
  const [, openHour, openMinute] = String(openTime ?? "").match(/^(\d{1,2}):(\d{2})$/) ?? [];

  const yearNumber = Number(year);
  if (!month || !day || openDaysBefore == null || openHour == null || !Number.isFinite(yearNumber)) {
    return null;
  }

  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const daysBeforeNumber = Number(openDaysBefore);
  const hourNumber = Number(openHour);
  const minuteNumber = Number(openMinute);
  if (
    !Number.isFinite(monthNumber) ||
    !Number.isFinite(dayNumber) ||
    !Number.isFinite(daysBeforeNumber) ||
    !Number.isFinite(hourNumber) ||
    !Number.isFinite(minuteNumber)
  ) {
    return null;
  }

  // Dec-Jan 경계 보정: 1월 경기는 다음 해.
  const gameYear = monthNumber === 1 ? yearNumber + 1 : yearNumber;

  // KST 시각을 UTC epoch 로: KST(+09:00) = UTC − 9h. Date.UTC 로 host TZ 배제.
  const gameOpenUtcMs = Date.UTC(gameYear, monthNumber - 1, dayNumber, hourNumber, minuteNumber) - 9 * 3600000;
  const openAtMs = gameOpenUtcMs - daysBeforeNumber * 86400000;
  if (!Number.isFinite(openAtMs)) {
    return null;
  }

  return toKstIso(openAtMs);
}

// epoch ms → ISO 문자열(+09:00 오프셋 표기). new Date().toISOString()은 Z(UTC)라
// +09:00 표기를 직접 만든다.
function toKstIso(epochMs) {
  const kst = new Date(epochMs + 9 * 3600000);
  const pad = (value, length = 2) => String(value).padStart(length, "0");
  const yyyy = pad(kst.getUTCFullYear(), 4);
  const MM = pad(kst.getUTCMonth() + 1);
  const dd = pad(kst.getUTCDate());
  const hh = pad(kst.getUTCHours());
  const mm = pad(kst.getUTCMinutes());
  const ss = pad(kst.getUTCSeconds());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}+09:00`;
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
    note: "KBO 공식 홈페이지 데이터를 자동 수집해 반영합니다.",
    sources: [
      { name: "KBO Team Standings", url: SOURCES.standings },
      { name: "KBO Daily Schedule", url: SOURCES.schedule },
      { name: "KBO Scoreboard", url: SOURCES.scoreboard },
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

// 전 구단 경기 보드. allSchedule(teamFilter:null) 을 그대로 받아 한화로 제한하지
// 않는다. 크기 과대 방지를 위해 최근 결과는 최근 RECENT_WINDOW_DAYS 일,
// 예정은 향후 UPCOMING_WINDOW_DAYS 일로 날짜 창으로만 자른다(팀 수 제한 없음).
function buildGames(schedule, scoreboard) {
  const recent = schedule.filter(
    (game) => game.type === "recent" && withinPastDays(game.date, RECENT_WINDOW_DAYS),
  );
  const upcoming = schedule.filter(
    (game) =>
      game.type === "upcoming" &&
      compareMonthDay(game.date, todayKey) >= 0 &&
      withinFutureDays(game.date, UPCOMING_WINDOW_DAYS),
  );
  return [...recent, ...upcoming]
    // 스코어보드 보강은 한화 관점(승/패/무)으로 계산하므로 한화 경기에만 적용한다.
    // 다른 팀 경기는 파서가 만든 중립 스코어(awayScore:homeScore)를 그대로 둔다.
    .map((game) => (includesHanwha(toEnglishMatchup(game)) ? mergeScoreboardGame(game, scoreboard) : game))
    .map((game) => ({ ...game, ticketing: buildTicketing(game) }))
    .map(({ rawTime, rawScore, ...game }) => game);
}

// schedule 의 home/away 는 한국어. includesHanwha/mergeScoreboardGame 은 영문
// 'HANWHA' 기준이므로 한화 포함 여부 판정을 위해 영문 팀명으로 환산해 본다.
function toEnglishMatchup(game) {
  return { ...game, away: toEnglishTeam(game.away), home: toEnglishTeam(game.home) };
}

function withinPastDays(date, days) {
  const diff = daysFromToday(date);
  return diff !== null && diff <= 0 && diff >= -days;
}

function withinFutureDays(date, days) {
  const diff = daysFromToday(date);
  return diff !== null && diff >= 0 && diff <= days;
}

// 경기 월.일과 오늘(KST) 사이의 일수 차이(미래는 양수). 시즌이 연말연초를
// 넘기는 경우는 KBO 정규시즌(3~10월)에서 발생하지 않아 단순 비교로 충분하다.
function daysFromToday(monthDay) {
  const gameDate = parseGameDate(monthDay, "12:00");
  if (!gameDate) {
    return null;
  }
  const todayDate = new Date(`${kstDate}T12:00:00+09:00`);
  return Math.round((gameDate.getTime() - todayDate.getTime()) / 86400000);
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

// 전 구단 오늘(KST) 경기 배열 — data/live-game.json 의 새 계약 shape.
// allSchedule(teamFilter:null) 에서 오늘 날짜 경기만 추출해 시간순으로 정렬하고,
// 스코어보드 matchup 매칭에 성공한 경기만 스코어/이닝/상태/라인스코어를 채운다.
// 매칭 실패 시 일정 기반 중립 상태(경기 예정). 오늘 경기가 없으면 빈 배열 [].
function buildLiveGames(allSchedule, scoreboard) {
  return allSchedule
    .filter((game) => game.date === todayKey)
    .sort(
      (left, right) =>
        String(left.rawTime ?? left.time ?? "").localeCompare(String(right.rawTime ?? right.time ?? "")) ||
        String(left.home).localeCompare(String(right.home)),
    )
    .map((game) => buildLiveGameEntry(game, scoreboard.find((item) => sameMatchup(item, game)) ?? null));
}

// 레거시 단일 경기 빌더 — 전 구단 일정(allSchedule) 수집 실패 시 한화 일정
// 기반 폴백 전용. UI 는 레거시 단일 객체도 방어적으로 허용한다.
function buildLiveGame(schedule, scoreboard) {
  const todayGame = schedule.find((game) => game.date === todayKey) ?? schedule.find((game) => game.type === "upcoming") ?? schedule.at(-1);
  const todayScoreboard = scoreboard.find((game) => includesHanwha(game) && sameMatchup(game, todayGame));

  if (!todayGame && !todayScoreboard) {
    return readExistingJson("live-game.json");
  }

  return buildLiveGameEntry(todayGame, todayScoreboard ?? null);
}

// 단일 경기 계약 shape 생성(팀 무관). 스코어보드 매칭 결과가 없으면 일정
// 정보만으로 '경기 예정' 상태를 만든다.
function buildLiveGameEntry(todayGame, scoreboardGame) {
  const game = scoreboardGame ?? todayGame;
  const [awayScore, homeScore] = scoreboardGame
    ? [scoreboardGame.awayScore, scoreboardGame.homeScore]
    : parseScore(todayGame.rawScore);
  const hasScore = awayScore !== null && homeScore !== null;
  // 점수가 들어왔다는 것은 '경기 시작'을 뜻할 뿐 '종료'가 아니다.
  // 종료 여부는 스코어보드 state(FINAL)로만 판정하고, 점수가 있으면서 종료가
  // 아니면 진행 중(live)으로 본다. 예전에는 점수만 있으면 무조건 final 로
  // 표기해 8회 진행 중 경기가 '경기 결과'로 잘못 보였다.
  const isFinal = game.state === "FINAL";
  const isLive = hasScore && !isFinal;

  // 스코어보드는 영문 팀명(HANWHA 등) → 한국어 환산, 일정은 이미 한국어라 그대로.
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
    date: todayGame.date,
    time: todayGame.time ?? localizeWeekday(game.rawTime ?? "", todayGame.date),
    // 스코어보드 location 은 파싱 실패 시 빈 문자열일 수 있어 || 로 일정 값 폴백.
    location: scoreboardGame?.location || todayGame.location,
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
  const nextContent = `${JSON.stringify(data, null, 2)}\n`;
  const filePath = join(DATA_DIR, fileName);
  try {
    const existingContent = await readFile(filePath, "utf8");
    if (existingContent === nextContent) {
      return;
    }
  } catch {
    // 기존 파일이 없거나 읽기 실패 시 새로 쓴다.
  }
  await writeFile(filePath, nextContent);
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
  buildSummary,
  buildTeamStandings,
  buildGames,
  buildLiveGame,
  buildLiveGames,
  buildTicketCalendar,
  buildOpenAt,
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
  writeJson,
};
