let data = {
  meta: {},
  summary: [],
  teamStandings: [],
  liveGame: {},
  rankings: [],
  games: [],
  ticketCalendar: [],
  players: [],
};

const dataFiles = {
  meta: "./data/meta.json",
  summary: "./data/summary.json",
  teamStandings: "./data/team-standings.json",
  liveGame: "./data/live-game.json",
  rankings: "./data/player-rankings.json",
  games: "./data/games.json",
  ticketCalendar: "./data/ticketing-calendar.json",
  players: "./data/players.json",
};

const MAX_UPCOMING_GAMES = 10;
const DATA_VERSION = "v=18";
const TICKET_REMINDER_MINUTES = 10;
const DEFAULT_VIEW = "live";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

const teamInitials = {
  한화: "E",
  LG: "LG",
  SSG: "SSG",
  두산: "D",
  KIA: "K",
  삼성: "S",
  롯데: "L",
  KT: "KT",
  NC: "NC",
  키움: "H",
};

// 구단 크레스트(엠블럼) 색상. 공식 로고가 아닌 자체 방패형 엠블럼용 팀 컬러.
const teamColors = {
  한화: { base: "#ff6a16", edge: "#c23e00", ink: "#ffffff" },
  LG: { base: "#c4194e", edge: "#8a0033", ink: "#ffffff" },
  SSG: { base: "#d10d2b", edge: "#960019", ink: "#ffffff" },
  두산: { base: "#1a2a6c", edge: "#0c1640", ink: "#ffffff" },
  KIA: { base: "#e3002b", edge: "#9c001d", ink: "#ffffff" },
  삼성: { base: "#1063b0", edge: "#063a6b", ink: "#ffffff" },
  롯데: { base: "#0a2a55", edge: "#c8102e", ink: "#ffffff" },
  KT: { base: "#2c2c30", edge: "#000000", ink: "#ffffff" },
  NC: { base: "#1d467f", edge: "#0f2c54", ink: "#f0d08a" },
  키움: { base: "#641a2e", edge: "#3c0a18", ink: "#ffffff" },
};

const ticketProviders = {
  한화: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/63",
    note: "한화 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  SSG: {
    provider: "SSG 티켓",
    url: "https://ticket.ssg.com/ticket",
    note: "SSG 홈 예매",
    openDaysBefore: 5,
    openTime: "11:00",
  },
  NC: {
    provider: "NC 다이노스",
    url: "https://www.ncdinos.com/",
    note: "NC 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  두산: {
    provider: "NOL 티켓",
    url: "https://tickets.interpark.com/contents/sports",
    note: "두산 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    earlyOpenLabel: "베어스클럽 10:00",
  },
  롯데: {
    provider: "롯데 자이언츠",
    url: "https://ticket.giantsclub.com/",
    note: "롯데 홈 예매",
    openDaysBefore: 14,
    openTime: "14:00",
    openCaution: "구단 앱 공지 기준 확인",
  },
  KIA: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/58",
    note: "KIA 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  키움: {
    provider: "NOL 티켓",
    url: "https://tickets.interpark.com/contents/sports",
    note: "키움 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
  },
  LG: {
    provider: "NOL 티켓",
    url: "https://tickets.interpark.com/contents/sports",
    note: "LG 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
  },
  KT: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "KT 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
  },
  삼성: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "삼성 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
  },
};

const summaryBoard = document.querySelector("#summaryBoard");
const liveGamePanel = document.querySelector("#liveGamePanel");
const rankingPanel = document.querySelector("#rankingPanel");
const rankingBoard = document.querySelector("#rankingBoard");
const teamStandingsBoard = document.querySelector("#teamStandingsBoard");
const gameList = document.querySelector("#gameList");
const featuredGame = document.querySelector("#featuredGame");
const ticketGameList = document.querySelector("#ticketGameList");
const ticketCalendarFilters = document.querySelector("#ticketCalendarFilters");
const ticketCalendarList = document.querySelector("#ticketCalendarList");
const playerGrid = document.querySelector("#playerGrid");
const themeToggle = document.querySelector("#themeToggle");
const installApp = document.querySelector("#installApp");
const notifyButton = document.querySelector("#notifyButton");
const dataUpdated = document.querySelector("#dataUpdated");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const viewTriggers = document.querySelectorAll("[data-view-target]");
let deferredInstallPrompt = null;
let toastTimer = null;
let lastUpdatedAt = null;

document.documentElement.classList.add("has-view-tabs");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// escape-by-default 태그드 템플릿.
// 보간되는 leaf 값은 기본적으로 escapeHtml 하고, SafeHtml(중첩 html`` 결과나
// 렌더 헬퍼 반환값)과 그 배열은 신뢰된 HTML 로 보고 이스케이프하지 않는다.
// KBO 외부 데이터(선수명/팀명/노트 등)가 그대로 innerHTML 에 들어가
// stored XSS 가 되던 경로를 일괄 차단한다.
class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

function raw(value) {
  return new SafeHtml(String(value));
}

function serializeHtml(value) {
  if (value instanceof SafeHtml) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeHtml).join("");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return escapeHtml(value);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += serializeHtml(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

async function fetchJson(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${separator}${DATA_VERSION}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }

  return response.json();
}

async function loadData() {
  const [meta, summary, teamStandings, liveGame, rankings, games, ticketCalendar, players] = await Promise.all([
    fetchJson(dataFiles.meta),
    fetchJson(dataFiles.summary),
    fetchJson(dataFiles.teamStandings),
    fetchJson(dataFiles.liveGame),
    fetchJson(dataFiles.rankings),
    fetchJson(dataFiles.games),
    fetchJson(dataFiles.ticketCalendar),
    fetchJson(dataFiles.players),
  ]);

  data = { meta, summary, teamStandings, liveGame, rankings, games, ticketCalendar, players };
}

function renderSummary() {
  summaryBoard.innerHTML = html`${data.summary.map(
    (item) => html`
        <article>
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.caption}</small>
        </article>
      `,
  )}`;
}

function renderGames(filter = "recent") {
  const games = filter === "all" ? data.games.filter((game) => game.type !== "upcoming") : data.games.filter((game) => game.type === filter);
  const featured = games[0] ?? data.games.find((game) => game.type !== "upcoming");

  if (!featured) {
    featuredGame.innerHTML = `<p class="meta">경기 데이터가 없습니다.</p>`;
    gameList.innerHTML = "";
    return;
  }

  featuredGame.innerHTML = html`
    <span class="game-status">${featured.status}</span>
    <div class="featured-score">
      <div class="team featured-team">
        ${renderTeamBadge(featured.away)}
        <div>
          <strong>${featured.away}</strong>
          <span>원정</span>
        </div>
      </div>
      <div class="score">${featured.score}</div>
      <div class="team featured-team home">
        ${renderTeamBadge(featured.home)}
        <div>
          <strong>${featured.home}</strong>
          <span>홈</span>
        </div>
      </div>
    </div>
    <p class="meta">${featured.date} · ${featured.time} · ${featured.location}</p>
    <p>${featured.detail}</p>
  `;

  gameList.innerHTML = html`${games.map(
    (game) => html`
        <article class="game-card">
          <time>${game.date}<br />${game.time}</time>
          <div class="matchup">
            <strong>${game.away} vs ${game.home}</strong>
            <span class="meta">${game.location} · ${game.detail}</span>
          </div>
          <span class="chip">${game.score}</span>
        </article>
      `,
  )}`;
}

function renderTickets() {
  const upcomingGames = data.games.filter((game) => game.type === "upcoming").slice(0, MAX_UPCOMING_GAMES);

  if (!upcomingGames.length) {
    ticketGameList.innerHTML = `<p class="meta">예정 경기 티켓팅 정보가 없습니다.</p>`;
    return;
  }

  ticketGameList.innerHTML = html`${upcomingGames.map(
    (game) => html`
        <article class="game-card ticket-game-card">
          <time>${game.date}<br />${game.time}</time>
          <div class="matchup">
            <strong>${game.away} vs ${game.home}</strong>
            <span class="meta">${game.location} · ${game.detail}</span>
            ${renderTicketInfo(game)}
          </div>
          <span class="chip">${game.score}</span>
        </article>
      `,
  )}`;
}

function calendarTeams() {
  const teams = new Set();
  for (const game of data.ticketCalendar) {
    teams.add(game.home);
    teams.add(game.away);
  }
  return [...teams].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function currentCalendarFilter() {
  return document.querySelector("[data-calendar-filter].active")?.dataset.calendarFilter ?? "all";
}

function renderTicketCalendar(filter = currentCalendarFilter()) {
  if (!ticketCalendarFilters || !ticketCalendarList) {
    return;
  }

  const teams = calendarTeams();
  ticketCalendarFilters.innerHTML = html`
    <button class="${raw(filter === "all" ? "active" : "")}" type="button" data-calendar-filter="all">전체</button>
    ${teams.map(
      (team) => html`
        <button class="${raw(filter === team ? "active" : "")}" type="button" data-calendar-filter="${team}">
          ${team}
        </button>
      `,
    )}
  `;

  const games =
    filter === "all"
      ? data.ticketCalendar
      : data.ticketCalendar.filter((game) => game.home === filter || game.away === filter);

  if (!games.length) {
    ticketCalendarList.innerHTML = `<p class="meta">선택한 구단의 예매 캘린더가 없습니다.</p>`;
    return;
  }

  ticketCalendarList.innerHTML = html`${games.map(
    (game) => html`
        <article class="game-card calendar-game-card">
          <time>${game.date}<br />${game.time}</time>
          <div class="matchup">
            <strong>
              ${renderTeamBadge(game.away)}
              ${game.away} vs ${renderTeamBadge(game.home)}
              ${game.home}
            </strong>
            <span class="meta">${game.location} · ${game.detail}</span>
            ${renderTicketInfo({ ...game, type: "upcoming" })}
          </div>
          <span class="chip">${game.ticketing?.provider ?? getTicketing(game).provider}</span>
        </article>
      `,
  )}`;
}

function renderTeamBadge(team) {
  const initial = teamInitials[team] ?? String(team).slice(0, 2).toUpperCase();
  const color = teamColors[team] ?? { base: "#4a4a4a", edge: "#262626", ink: "#ffffff" };
  const eagles = team === "한화" ? " is-eagles" : "";
  const fontSize = initial.length >= 3 ? 11.5 : initial.length === 2 ? 14.5 : 19;
  return html`<span class="team-crest${raw(eagles)}" aria-hidden="true">
      <svg viewBox="0 0 44 50" role="img">
        <path
          d="M22 1.5 L41 8 L41 26.5 C41 37.6 32.4 44.8 22 48.6 C11.6 44.8 3 37.6 3 26.5 L3 8 Z"
          fill="${raw(color.base)}"
          stroke="${raw(color.edge)}"
          stroke-width="2.4"
          stroke-linejoin="round"
        />
        <path
          d="M22 1.5 L41 8 L41 19 C41 19 33 23 22 23 C11 23 3 19 3 19 L3 8 Z"
          fill="#ffffff"
          fill-opacity="0.16"
        />
        <text
          x="22"
          y="31.5"
          text-anchor="middle"
          font-family="'Noto Sans KR', sans-serif"
          font-size="${raw(fontSize)}"
          font-weight="900"
          fill="${raw(color.ink)}"
        >${initial}</text>
      </svg>
    </span>`;
}

function gameId(game) {
  return [game.date, game.time, game.away, game.home].join("|");
}

function getTicketReminders() {
  try {
    return JSON.parse(localStorage.getItem("eaglesTicketReminders") ?? "{}");
  } catch {
    return {};
  }
}

function setTicketReminder(game, ticketing) {
  const openInfo = getTicketOpenInfo(game, ticketing);

  if (!openInfo.reminderAt) {
    return null;
  }

  const reminders = getTicketReminders();
  reminders[gameId(game)] = {
    gameId: gameId(game),
    matchup: `${game.away} vs ${game.home}`,
    date: game.date,
    time: game.time,
    location: game.location,
    provider: ticketing.provider,
    url: ticketing.url,
    openAt: openInfo.openAt.toISOString(),
    remindAt: openInfo.reminderAt.toISOString(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem("eaglesTicketReminders", JSON.stringify(reminders));
  return reminders[gameId(game)];
}

function getTicketing(game) {
  const baseProvider = ticketProviders[game.home] ?? {
    provider: "홈팀 예매처",
    url: "https://www.koreabaseball.com/Schedule/Schedule.aspx",
    note: "KBO 일정에서 홈팀 예매처 확인",
    openDaysBefore: 7,
    openTime: "11:00",
  };
  const provider = { ...baseProvider, ...(game.ticketing ?? {}) };

  return {
    ...provider,
    venueType: game.home === "한화" ? "홈" : "원정",
    status: game.type === "upcoming" ? "예매 확인" : "예매 종료",
    openLabel: provider.openLabel ?? "홈팀 예매 일정 기준",
  };
}

function seasonYear() {
  const year = Number(String(data.meta.updatedAt ?? "").match(/^\d{4}/)?.[0]);
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}

function parseKstDate(monthDay, timeText) {
  const [, month, day] = String(monthDay).match(/^(\d{2})\.(\d{2})$/) ?? [];
  const [, hour, minute] = String(timeText).match(/(\d{1,2}):(\d{2})/) ?? [];

  if (!month || !day || !hour || !minute) {
    return null;
  }

  const year = seasonYear();
  return new Date(`${year}-${month}-${day}T${hour.padStart(2, "0")}:${minute}:00+09:00`);
}

function formatKstDateTime(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\.\s/g, ".")
    .replace(/\.$/, "");
}

function getTicketOpenInfo(game, ticketing) {
  const gameDate = parseKstDate(game.date, game.time);

  if (!gameDate || !ticketing.openDaysBefore || !ticketing.openTime) {
    return {
      openAt: null,
      reminderAt: null,
      openText: "예매 오픈 시간 확인 필요",
      reminderText: "알림 시간 계산 대기",
      isOpen: false,
      canRemind: false,
    };
  }

  const [hour, minute] = ticketing.openTime.split(":");
  const openAt = new Date(gameDate);
  openAt.setDate(openAt.getDate() - Number(ticketing.openDaysBefore));
  openAt.setHours(Number(hour), Number(minute), 0, 0);

  const reminderAt = new Date(openAt.getTime() - TICKET_REMINDER_MINUTES * 60 * 1000);
  const now = new Date();
  const isOpen = now >= openAt;
  const canRemind = now < reminderAt;
  const caution = ticketing.openCaution ? ` · ${ticketing.openCaution}` : "";
  const early = ticketing.earlyOpenLabel ? ` · ${ticketing.earlyOpenLabel}` : "";

  return {
    openAt,
    reminderAt,
    openText: `예매 오픈 ${formatKstDateTime(openAt)}${early}${caution}`,
    reminderText: `알림 ${formatKstDateTime(reminderAt)} (${TICKET_REMINDER_MINUTES}분 전)`,
    isOpen,
    canRemind,
  };
}

function renderTicketInfo(game, featured = false) {
  const ticketing = getTicketing(game);
  const isUpcoming = game.type === "upcoming";
  const openInfo = getTicketOpenInfo(game, ticketing);
  const reminderOn = Boolean(getTicketReminders()[gameId(game)]);
  const alertLabel = reminderOn ? "알림 설정됨" : openInfo.canRemind ? "10분 전 알림" : openInfo.isOpen ? "오픈됨" : "시간 확인";
  const ticketStatus = isUpcoming ? (openInfo.isOpen ? "예매 중" : "오픈 전") : "예매 종료";
  const canClickReminder = isUpcoming && (reminderOn || openInfo.canRemind);

  return html`
    <div class="ticket-strip ${raw(featured ? "featured" : "")}">
      <div>
        <span>${ticketing.venueType} · ${ticketing.provider}</span>
        <strong>${ticketStatus}</strong>
        <small>${openInfo.openText}</small>
        <small>${openInfo.reminderText}</small>
      </div>
      <div class="ticket-actions">
        <a href="${ticketing.url}" target="_blank" rel="noopener">예매처</a>
        <button class="${raw(reminderOn ? "is-on" : "")}" type="button" data-ticket-alert="${gameId(game)}" ${raw(canClickReminder ? "" : "disabled")}>
          ${isUpcoming ? alertLabel : "종료"}
        </button>
      </div>
    </div>
  `;
}

function showToast(message) {
  let toast = document.querySelector(".toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }

  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function scoreValue(score) {
  return score === null || score === undefined ? "-" : score;
}

function renderLineScore(game, linescore) {
  if (!linescore.length) {
    return html`<p class="meta">이닝별 스코어를 준비 중입니다.</p>`;
  }

  const inningHeads = linescore.map((item) => html`<th scope="col">${item.inning}</th>`);
  const awayScores = linescore.map((item) => html`<td>${scoreValue(item.away)}</td>`);
  const homeScores = linescore.map((item) => html`<td>${scoreValue(item.home)}</td>`);

  return html`
    <div class="line-score" aria-label="이닝별 스코어">
      <table>
        <thead>
          <tr>
            <th scope="col">팀</th>
            ${inningHeads}
            <th scope="col">R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">${game.awayTeam}</th>
            ${awayScores}
            <td class="total">${scoreValue(game.awayScore)}</td>
          </tr>
          <tr>
            <th scope="row">${game.homeTeam}</th>
            ${homeScores}
            <td class="total">${scoreValue(game.homeScore)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderLiveGame() {
  const game = data.liveGame;
  const linescore = game.linescore ?? [];

  liveGamePanel.innerHTML = html`
    <div class="live-head">
      <span class="game-status">${game.statusLabel}</span>
      <span class="meta">${game.date} · ${game.time} · ${game.location}</span>
    </div>
    <div class="live-scoreboard">
      <div class="live-team away">
        <div class="team-identity">
          ${renderTeamBadge(game.awayTeam)}
          <div>
            <span>원정</span>
            <strong>${game.awayTeam}</strong>
          </div>
        </div>
        <b>${scoreValue(game.awayScore)}</b>
      </div>
      <div class="live-state">
        <span>${game.inning}</span>
        <strong>${game.state}</strong>
      </div>
      <div class="live-team home">
        <div class="team-identity">
          ${renderTeamBadge(game.homeTeam)}
          <div>
            <span>홈</span>
            <strong>${game.homeTeam}</strong>
          </div>
        </div>
        <b>${scoreValue(game.homeScore)}</b>
      </div>
    </div>
    <p>${game.note}</p>
    ${renderLineScore(game, linescore)}
  `;
}

function renderRankingList(rankings, compact = false) {
  return html`${rankings.map(
    (item) => html`
        <li>
          <span class="rank-no">${item.rank}</span>
          <span class="rank-name">${item.name}</span>
          <strong>${item.value}</strong>
          ${compact ? "" : html`<small>${item.note}</small>`}
        </li>
      `,
  )}`;
}

function renderRankingPanels() {
  const featuredGroups = data.rankings.slice(0, 2);

  rankingPanel.innerHTML = html`${featuredGroups.map(
    (group) => html`
        <section>
          <div>
            <span class="chip">${group.scope}</span>
            <h3>${group.title}</h3>
          </div>
          <ol class="ranking-list compact">${renderRankingList(group.players, true)}</ol>
        </section>
      `,
  )}`;

  teamStandingsBoard.innerHTML = html`
    <div class="standings-table" aria-label="KBO 전체 팀 순위">
      <table>
        <thead>
          <tr>
            <th scope="col">순위</th>
            <th scope="col">팀</th>
            <th scope="col">승</th>
            <th scope="col">패</th>
            <th scope="col">무</th>
            <th scope="col">승률</th>
            <th scope="col">게임차</th>
            <th scope="col">흐름</th>
          </tr>
        </thead>
        <tbody>
          ${data.teamStandings.map(renderStandingRow)}
        </tbody>
      </table>
    </div>
  `;

  rankingBoard.innerHTML = html`${data.rankings.map(
    (group) => html`
        <article class="ranking-card">
          <div class="ranking-card-head">
            <span class="chip">${group.scope}</span>
            <h3>${group.title}</h3>
          </div>
          <ol class="ranking-list">${renderRankingList(group.players)}</ol>
        </article>
      `,
  )}`;
}

function renderStandingRow(team) {
  return html`
    <tr class="${raw(team.isHanwha ? "is-hanwha" : "")}">
      <td><span class="rank-pill">${team.rank}</span></td>
      <th scope="row">
        <span class="standing-team">
          ${renderTeamBadge(team.team)}
          <span>${team.team}</span>
        </span>
      </th>
      <td>${team.wins}</td>
      <td>${team.losses}</td>
      <td>${team.draws}</td>
      <td>${team.pct}</td>
      <td>${team.gamesBehind}</td>
      <td>${team.streak}</td>
    </tr>
  `;
}

function renderPlayers(filter = "all") {
  const players = filter === "all" ? data.players : data.players.filter((player) => player.type === filter);

  playerGrid.innerHTML = html`${players.map(
    (player) => html`
        <article class="player-card">
          <div class="player-head">
            <span class="chip">${player.role}</span>
            <span class="number">${player.number}</span>
          </div>
          <h3>${player.name}</h3>
          <p class="meta">${player.note}</p>
          <div class="stat-line">
            ${player.stats.map(
              (stat) => html`
                  <div>
                    <span>${stat.label}</span>
                    <strong>${stat.value}</strong>
                  </div>
                `,
            )}
          </div>
        </article>
      `,
  )}`;
}

function renderMeta() {
  dataUpdated.textContent = `데이터 기준: ${data.meta.updatedAt}. ${data.meta.note}`;
}

function currentGameFilter() {
  return document.querySelector("[data-game-filter].active")?.dataset.gameFilter ?? "recent";
}

function currentPlayerFilter() {
  return document.querySelector("[data-player-filter].active")?.dataset.playerFilter ?? "all";
}

function renderAll() {
  renderMeta();
  renderSummary();
  renderLiveGame();
  renderRankingPanels();
  renderGames(currentGameFilter());
  renderTickets();
  renderTicketCalendar();
  renderPlayers(currentPlayerFilter());
}

async function pollData() {
  if (document.hidden) {
    return;
  }

  try {
    const meta = await fetchJson(dataFiles.meta);

    if (meta.updatedAt && meta.updatedAt === lastUpdatedAt) {
      return;
    }

    await loadData();
    lastUpdatedAt = data.meta.updatedAt;
    renderAll();
    showToast("최신 데이터로 갱신했어요.");
  } catch {
    // 네트워크 오류 시 다음 주기에 다시 시도한다.
  }
}

async function registerPeriodicSync(registration) {
  if (!registration || !("periodicSync" in registration)) {
    return;
  }

  try {
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });

    if (status.state !== "granted") {
      return;
    }

    await registration.periodicSync.register("refresh-data", {
      minInterval: 6 * 60 * 60 * 1000,
    });
  } catch {
    // 미지원 또는 권한 거부 시 무시한다.
  }
}

function renderDataError(error) {
  summaryBoard.innerHTML = `
    <article>
      <span>데이터 오류</span>
      <strong>확인 필요</strong>
      <small>로컬 서버로 열어주세요</small>
    </article>
  `;
  featuredGame.innerHTML = `<p class="meta">데이터를 불러오지 못했습니다: ${error.message}</p>`;
  ticketGameList.innerHTML = `<p class="meta">티켓팅 정보를 불러오지 못했습니다.</p>`;
  liveGamePanel.innerHTML = `<p class="meta">실시간 경기 데이터를 불러오지 못했습니다.</p>`;
  teamStandingsBoard.innerHTML = `<p class="meta">KBO 팀 순위 데이터를 불러오지 못했습니다.</p>`;
}

function setActiveButton(buttons, selected) {
  buttons.forEach((button) => {
    button.classList.toggle("active", button === selected);
  });
}

function viewExists(view) {
  return [...viewPanels].some((panel) => panel.dataset.viewPanel === view);
}

function viewFromHash(hash = window.location.hash) {
  const id = hash.replace("#", "");
  return viewExists(id) ? id : DEFAULT_VIEW;
}

function setActiveView(view = DEFAULT_VIEW, updateHash = true) {
  const selectedView = viewExists(view) ? view : DEFAULT_VIEW;

  viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== selectedView;
  });

  viewTriggers.forEach((trigger) => {
    const isActive = trigger.dataset.viewTarget === selectedView;
    trigger.classList.toggle("active", isActive);
    trigger.toggleAttribute("aria-current", isActive);

    if (trigger.tagName === "BUTTON") {
      trigger.setAttribute("aria-selected", String(isActive));
    }
  });

  if (updateHash && window.location.hash !== `#${selectedView}`) {
    window.history.pushState(null, "", `#${selectedView}`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

viewTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveView(trigger.dataset.viewTarget);
  });
});

window.addEventListener("popstate", () => {
  setActiveView(viewFromHash(), false);
});

document.querySelectorAll("[data-game-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveButton(document.querySelectorAll("[data-game-filter]"), button);
    renderGames(button.dataset.gameFilter);
  });
});

document.querySelectorAll("[data-player-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveButton(document.querySelectorAll("[data-player-filter]"), button);
    renderPlayers(button.dataset.playerFilter);
  });
});

ticketCalendarFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-filter]");

  if (!button) {
    return;
  }

  setActiveButton(ticketCalendarFilters.querySelectorAll("[data-calendar-filter]"), button);
  renderTicketCalendar(button.dataset.calendarFilter);
});

function syncThemeColor(isDark) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", isDark ? "#17120f" : "#f6f2ec");
  }
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.classList.toggle("dark");
  syncThemeColor(isDark);
  try {
    localStorage.setItem("eaglesTheme", isDark ? "dark" : "light");
  } catch {
    // localStorage 비활성 환경에서는 세션 한정으로만 적용된다.
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installApp.hidden = false;
});

installApp.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installApp.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installApp.hidden = true;
});

function notificationSupported() {
  return "Notification" in window && "serviceWorker" in navigator && window.isSecureContext;
}

function updateNotifyButton() {
  if (!notifyButton) {
    return;
  }

  if (!notificationSupported()) {
    notifyButton.hidden = true;
    return;
  }

  notifyButton.hidden = false;
  notifyButton.disabled = Notification.permission === "denied";
  notifyButton.classList.toggle(
    "is-on",
    Notification.permission === "granted" && localStorage.getItem("eaglesNotifications") === "on",
  );

  if (Notification.permission === "denied") {
    notifyButton.textContent = "알림 차단됨";
  } else if (Notification.permission === "granted" && localStorage.getItem("eaglesNotifications") === "on") {
    notifyButton.textContent = "알림 켜짐";
  } else {
    notifyButton.textContent = "알림 켜기";
  }
}

function buildGameNotification() {
  const game = data.liveGame ?? {};
  const awayScore = scoreValue(game.awayScore);
  const homeScore = scoreValue(game.homeScore);
  const matchup = game.awayTeam && game.homeTeam ? `${game.awayTeam} ${awayScore}:${homeScore} ${game.homeTeam}` : "한화 경기";
  const schedule = [game.date, game.time, game.location].filter(Boolean).join(" · ");

  return {
    title: "이글스 경기 알림",
    body: `${matchup}${schedule ? ` · ${schedule}` : ""}`,
  };
}

async function showGameNotification() {
  const registration = await navigator.serviceWorker.ready;
  const notification = buildGameNotification();

  await registration.showNotification(notification.title, {
    body: notification.body,
    icon: "./assets/app-icon.svg",
    badge: "./assets/app-icon.svg",
    tag: "eagles-game-alert",
    data: {
      url: "./index.html#live",
    },
  });
}

async function showTicketNotification(game, ticketing, title = "티켓 알림 설정됨") {
  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification(title, {
    body: `${game.date} ${game.time} ${game.away} vs ${game.home} · ${ticketing.provider}`,
    icon: "./assets/app-icon.svg",
    badge: "./assets/app-icon.svg",
    tag: `eagles-ticket-${gameId(game)}`,
    data: {
      url: ticketing.url,
    },
  });
}

async function maybeShowTicketNotification(game, ticketing) {
  if (!notificationSupported()) {
    return false;
  }

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    updateNotifyButton();
    return false;
  }

  localStorage.setItem("eaglesNotifications", "on");
  updateNotifyButton();
  await showTicketNotification(game, ticketing);
  return true;
}

async function enableNotifications() {
  if (!notificationSupported()) {
    return;
  }

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "granted") {
    localStorage.setItem("eaglesNotifications", "on");
    updateNotifyButton();
    await showGameNotification();
    return;
  }

  updateNotifyButton();
}

notifyButton?.addEventListener("click", enableNotifications);

async function enableTicketReminder(gameKey) {
  const game = [...data.games, ...(data.ticketCalendar ?? [])].find((item) => gameId(item) === gameKey);

  if (!game || game.type !== "upcoming") {
    return;
  }

  const ticketing = getTicketing(game);
  const reminder = setTicketReminder(game, ticketing);

  if (!reminder) {
    showToast("예매 오픈 시간이 확정되지 않아 알림 시간을 계산하지 못했습니다.");
    return;
  }

  renderGames(document.querySelector("[data-game-filter].active")?.dataset.gameFilter ?? "recent");
  renderTickets();
  renderTicketCalendar();
  showToast(`${formatKstDateTime(new Date(reminder.remindAt))} 티켓 알림을 저장했습니다.`);

  if (!(await maybeShowTicketNotification(game, ticketing))) {
    showToast(`${formatKstDateTime(new Date(reminder.remindAt))} 알림 저장됨 · 앱이 열려 있으면 알려드릴게요.`);
  }
}

async function checkTicketReminders() {
  const reminders = getTicketReminders();
  const now = Date.now();
  let changed = false;

  for (const [key, reminder] of Object.entries(reminders)) {
    if (reminder.notifiedAt || !reminder.remindAt || new Date(reminder.remindAt).getTime() > now) {
      continue;
    }

    changed = true;
    reminder.notifiedAt = new Date().toISOString();
    showToast(`${reminder.matchup} 예매 오픈 10분 전입니다.`);

    if (notificationSupported() && Notification.permission === "granted") {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("티켓팅 10분 전", {
        body: `${reminder.matchup} · ${reminder.provider} ${formatKstDateTime(new Date(reminder.openAt))} 오픈`,
        icon: "./assets/app-icon.svg",
        badge: "./assets/app-icon.svg",
        tag: `eagles-ticket-due-${key}`,
        data: {
          url: reminder.url,
        },
      });
    }
  }

  if (changed) {
    // 루프 안 await(showNotification) 동안 사용자가 새 티켓 알림을 저장했을 수
    // 있으므로, 들고 있던 옛 스냅샷을 통째로 덮어쓰지 않고 최신본을 다시 읽어
    // notifiedAt 변경분만 병합한다(read-modify-write 경쟁 방지).
    const latest = getTicketReminders();
    for (const [key, reminder] of Object.entries(reminders)) {
      if (reminder.notifiedAt && latest[key]) {
        latest[key].notifiedAt = reminder.notifiedAt;
      }
    }
    localStorage.setItem("eaglesTicketReminders", JSON.stringify(latest));
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ticket-alert]");

  if (!button) {
    return;
  }

  enableTicketReminder(button.dataset.ticketAlert);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        updateNotifyButton();
        registerPeriodicSync(registration);
      })
      .catch(updateNotifyButton);
  });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    pollData();
  }
});

updateNotifyButton();
setActiveView(viewFromHash(), false);
loadData()
  .then(() => {
    lastUpdatedAt = data.meta.updatedAt;
    renderAll();
  })
  .catch(renderDataError);
window.setInterval(checkTicketReminders, 30 * 1000);
checkTicketReminders();
window.setInterval(pollData, POLL_INTERVAL_MS);
