export const KBO_SCHEDULE_API_URL = "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList";

const KBO_SCHEDULE_PAGE_URL = "https://www.koreabaseball.com/Schedule/Schedule.aspx";

export async function fetchKoreanScheduleMonth({ seasonId, gameMonth, fetchImpl = fetch }) {
  const body = new URLSearchParams({
    leId: "1",
    srIdList: "0,9,6",
    seasonId: String(seasonId),
    gameMonth: String(gameMonth).padStart(2, "0"),
    teamId: "HH",
  });

  const response = await fetchImpl(KBO_SCHEDULE_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "referer": KBO_SCHEDULE_PAGE_URL,
      "user-agent": "Mozilla/5.0 (compatible; EaglesLoungeDataBot/1.0)",
      "x-requested-with": "XMLHttpRequest",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`KBO schedule API fetch failed: ${response.status}`);
  }

  return response.json();
}

export function parseKoreanScheduleRows(rows) {
  const games = [];

  for (const entry of rows ?? []) {
    const cells = entry.row ?? [];
    const date = parseMonthDay(cells[0]?.Text);
    const rawTime = cleanText(cells[1]?.Text);
    const matchup = parseMatchup(cells[2]?.Text);
    const location = cleanText(cells[7]?.Text);

    if (!date || !rawTime || !matchup || !location || !includesHanwha(matchup)) {
      continue;
    }

    const isUpcoming = matchup.rawScore === ":";
    games.push({
      type: isUpcoming ? "upcoming" : "recent",
      status: isUpcoming ? "예정 경기" : "최근 결과",
      date,
      time: `${parseWeekday(cells[0]?.Text)} ${rawTime}`.trim(),
      rawTime,
      location,
      home: matchup.home,
      away: matchup.away,
      score: isUpcoming ? "경기전" : resultLabel(matchup),
      rawScore: matchup.rawScore,
      detail: isUpcoming ? `${matchup.home} 홈 경기` : `${location} 경기`,
    });
  }

  return games;
}

export function mergeScheduleMonths(months) {
  const seen = new Set();
  const games = [];

  for (const month of months) {
    for (const game of month) {
      const key = [game.date, game.rawTime, game.away, game.home].join("|");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      games.push(game);
    }
  }

  return games;
}

export function scheduleMonthTargets(year, month) {
  const currentMonth = Number(month);
  const nextDate = new Date(Date.UTC(Number(year), currentMonth, 1));

  return [
    { seasonId: String(year), gameMonth: String(currentMonth).padStart(2, "0") },
    {
      seasonId: String(nextDate.getUTCFullYear()),
      gameMonth: String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
    },
  ];
}

function parseMonthDay(value) {
  return cleanText(value).match(/^(\d{2}\.\d{2})/)?.[1] ?? "";
}

function parseWeekday(value) {
  return cleanText(value).match(/\(([^)]+)\)/)?.[1] ?? "";
}

function parseMatchup(value) {
  const parts = [...String(value ?? "").matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((match) => cleanText(match[1]));
  const vsIndex = parts.findIndex((part) => part.toLowerCase() === "vs");

  if (vsIndex < 1 || vsIndex >= parts.length - 1) {
    return null;
  }

  const away = normalizeTeam(parts[0]);
  const home = normalizeTeam(parts.at(-1));
  const awayScore = parseScorePart(parts[vsIndex - 1]);
  const homeScore = parseScorePart(parts[vsIndex + 1]);
  const rawScore = awayScore === null || homeScore === null ? ":" : `${awayScore}:${homeScore}`;

  return { away, home, awayScore, homeScore, rawScore };
}

function parseScorePart(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function resultLabel(matchup) {
  const hanwhaScore = matchup.away === "한화" ? matchup.awayScore : matchup.homeScore;
  const opponentScore = matchup.away === "한화" ? matchup.homeScore : matchup.awayScore;
  const result = hanwhaScore > opponentScore ? "승" : hanwhaScore < opponentScore ? "패" : "무";
  return `${result} ${hanwhaScore}:${opponentScore}`;
}

function includesHanwha(matchup) {
  return matchup.away === "한화" || matchup.home === "한화";
}

function normalizeTeam(team) {
  return team === "kt" ? "KT" : team;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
