let data = {
  meta: {},
  summary: [],
  teamStandings: [],
  liveGame: [],
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
const DATA_VERSION = "v=19";
const TICKET_REMINDER_MINUTES = 10;
const DEFAULT_VIEW = "home";
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DEMAND_SIGNALS_KEY = "eaglesDemandSignals";
const DEMAND_EVENT_LIMIT = 12;
const SELECTED_TEAM_KEY = "selectedTeam";
const DEFAULT_TEAM = "한화";
const CANCEL_WATCH_KEY = "cancelWatchGames";
// 취소표 확인 리마인더 슬롯 — 경기 전날 21:00, 경기 당일 11:00 (각 1회).
const CANCEL_WATCH_SLOTS = [
  { id: "eve-2100", offsetDays: -1, time: "21:00" },
  { id: "day-1100", offsetDays: 0, time: "11:00" },
];
const CANCEL_STATUS_CLASS = {
  official: "is-official",
  manual: "is-manual",
  "link-only": "is-link-only",
};

const teamInitials = {
  한화: "한화",
  LG: "LG",
  SSG: "SSG",
  두산: "두산",
  KIA: "기아",
  삼성: "삼성",
  롯데: "롯데",
  KT: "KT",
  NC: "NC",
  키움: "키움",
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

function readSelectedTeam() {
  try {
    const stored = localStorage.getItem(SELECTED_TEAM_KEY);
    return stored && teamColors[stored] ? stored : DEFAULT_TEAM;
  } catch {
    return DEFAULT_TEAM;
  }
}

let selectedTeam = readSelectedTeam();

function setSelectedTeam(team) {
  if (!teamColors[team]) {
    return;
  }
  selectedTeam = team;
  try {
    localStorage.setItem(SELECTED_TEAM_KEY, team);
  } catch {
    // localStorage 비활성 환경에서는 세션 한정으로만 적용된다.
  }
}

// 예매처별 취소표/예매대기 서비스 메타 (컨시어지형 — 자동 잔여석 감시 없음).
const cancelWaitingTicketlink = {
  status: "official",
  label: "공식 취소표 대기 지원",
  guideUrl: "https://www.ticketlink.co.kr/help/guide/waitingGuide",
};
const cancelWaitingInterpark = {
  status: "official",
  label: "공식 예매대기 지원",
  guideUrl: "https://ticket.interpark.com/TiKi/Info/BookingGuide.asp?Url=guide_13.html",
};
const cancelWaitingManual = {
  status: "manual",
  label: "공식 대기 서비스 확인 안 됨 · 직접 확인",
};
const cancelWaitingLinkOnly = {
  status: "link-only",
  label: "공식 링크만 지원",
};

const ticketProviders = {
  한화: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/63",
    note: "한화 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    cancelWaiting: cancelWaitingTicketlink,
  },
  SSG: {
    provider: "SSG 티켓",
    url: "https://ticket.ssg.com/ticket",
    note: "SSG 홈 예매",
    openDaysBefore: 5,
    openTime: "11:00",
    cancelWaiting: cancelWaitingManual,
  },
  NC: {
    provider: "NC 다이노스",
    url: "https://www.ncdinos.com/",
    note: "NC 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    cancelWaiting: cancelWaitingManual,
  },
  두산: {
    provider: "NOL 티켓",
    url: "https://nol.interpark.com/ticket",
    note: "두산 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    earlyOpenLabel: "베어스클럽 10:00",
    cancelWaiting: cancelWaitingInterpark,
  },
  롯데: {
    provider: "롯데 자이언츠",
    url: "https://ticket.giantsclub.com/",
    note: "롯데 홈 예매",
    openDaysBefore: 14,
    openTime: "14:00",
    openCaution: "구단 앱 공지 기준 확인",
    cancelWaiting: cancelWaitingLinkOnly,
  },
  KIA: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/58",
    note: "KIA 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    cancelWaiting: cancelWaitingTicketlink,
  },
  키움: {
    provider: "NOL 티켓",
    url: "https://nol.interpark.com/ticket",
    note: "키움 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    cancelWaiting: cancelWaitingInterpark,
  },
  LG: {
    provider: "NOL 티켓",
    url: "https://nol.interpark.com/ticket",
    note: "LG 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
    cancelWaiting: cancelWaitingInterpark,
  },
  KT: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "KT 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
    cancelWaiting: cancelWaitingTicketlink,
  },
  삼성: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "삼성 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
    cancelWaiting: cancelWaitingTicketlink,
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
const cancelWatchList = document.querySelector("#cancelWatchList");
const playerGrid = document.querySelector("#playerGrid");
const demandSignalBoard = document.querySelector("#demandSignalBoard");
const demandSignalEvents = document.querySelector("#demandSignalEvents");
const exportDemandSignals = document.querySelector("#exportDemandSignals");
const resetDemandSignals = document.querySelector("#resetDemandSignals");
const teamSelect = document.querySelector("#teamSelect");
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

function summaryCardsForSelectedTeam() {
  const row = (data.teamStandings ?? []).find((team) => team.team === selectedTeam);
  if (!row) {
    return null;
  }
  const totalTeams = data.teamStandings.length;
  return [
    { label: "순위", value: `${row.rank}위`, caption: `${totalTeams}팀 중` },
    { label: "승-패", value: `${row.wins}-${row.losses}`, caption: `무 ${row.draws}` },
    { label: "승률", value: row.pct, caption: `${selectedTeam} 시즌` },
    { label: "최근 흐름", value: row.streak, caption: `${selectedTeam} 기준` },
  ];
}

function renderSummary() {
  // 내 구단 행에서 4카드 파생, 없으면 기존 한화 고정 summary 로 폴백.
  const cards = summaryCardsForSelectedTeam() ?? data.summary;
  summaryBoard.innerHTML = html`${cards.map(
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
  // 전구단 games 를 내 구단(홈/원정)으로 먼저 필터.
  const teamGames = data.games.filter((game) => game.home === selectedTeam || game.away === selectedTeam);
  const games = filter === "all" ? teamGames.filter((game) => game.type !== "upcoming") : teamGames.filter((game) => game.type === filter);
  const featured = games[0] ?? teamGames.find((game) => game.type !== "upcoming");

  if (!featured) {
    featuredGame.innerHTML = `<p class="meta">${selectedTeam} 경기 데이터가 없습니다.</p>`;
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
  const active = document.querySelector("[data-calendar-filter].active")?.dataset.calendarFilter;
  if (active) {
    return active;
  }
  // 초기 렌더: 선택 팀이 캘린더에 등장하면 그 팀을 기본 필터로, 아니면 전체.
  return calendarTeams().includes(selectedTeam) ? selectedTeam : "all";
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
  const myTeam = team === selectedTeam ? " is-myteam" : "";
  const fontSize = initial.length >= 3 ? 12.5 : initial.length === 2 ? 15.5 : 20;
  return html`<span class="team-crest${raw(myTeam)}" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <rect
          x="2.5"
          y="2.5"
          width="43"
          height="43"
          rx="15"
          ry="15"
          fill="${raw(color.base)}"
          stroke="${raw(color.edge)}"
          stroke-width="2"
        />
        <text
          x="24"
          y="24.5"
          text-anchor="middle"
          dominant-baseline="central"
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

// ----- 취소표 컨시어지 (자동 잔여석 감시 없음 — 확인 리마인더 + 공식 대기 서비스 안내만) -----

function getCancelWatchGames() {
  try {
    const stored = JSON.parse(localStorage.getItem(CANCEL_WATCH_KEY) ?? "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

function saveCancelWatchGames(watches) {
  try {
    localStorage.setItem(CANCEL_WATCH_KEY, JSON.stringify(watches));
  } catch {
    // localStorage 비활성 환경에서는 세션 한정으로만 동작한다.
  }
}

function toggleCancelWatch(game) {
  const key = gameId(game);
  const watches = getCancelWatchGames();

  if (watches[key]) {
    delete watches[key];
    saveCancelWatchGames(watches);
    return { key, saved: false };
  }

  const ticketing = getTicketing(game);
  watches[key] = {
    away: game.away,
    home: game.home,
    date: game.date,
    time: game.time,
    location: game.location,
    provider: ticketing.provider,
    url: ticketing.url,
    savedAt: new Date().toISOString(),
    firedReminders: [],
  };
  saveCancelWatchGames(watches);
  return { key, saved: true };
}

function removeCancelWatch(key) {
  const watches = getCancelWatchGames();

  if (!watches[key]) {
    return null;
  }

  const removed = watches[key];
  delete watches[key];
  saveCancelWatchGames(watches);
  return removed;
}

function pruneCancelWatchGames() {
  // 지난 경기(오늘 이전 날짜)는 자동 정리한다. 당일 경기는 유지.
  const watches = getCancelWatchGames();
  const now = Date.now();
  let changed = false;

  for (const [key, entry] of Object.entries(watches)) {
    const endOfGameDay = parseKstDate(entry.date, "23:59");

    if (endOfGameDay && endOfGameDay.getTime() < now) {
      delete watches[key];
      changed = true;
    }
  }

  if (changed) {
    saveCancelWatchGames(watches);
  }

  return watches;
}

function cancelWaitingMeta(homeTeam) {
  return ticketProviders[homeTeam]?.cancelWaiting ?? cancelWaitingManual;
}

function emptyDemandSignals(now = new Date()) {
  const timestamp = now.toISOString();

  return {
    version: 1,
    firstSeenAt: timestamp,
    updatedAt: timestamp,
    eventCounts: {},
    teams: {},
    providers: {},
    permissionResults: {},
    lastEvents: [],
  };
}

function readDemandSignals() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMAND_SIGNALS_KEY) ?? "null");

    if (!stored || typeof stored !== "object") {
      return emptyDemandSignals();
    }

    return {
      ...emptyDemandSignals(),
      ...stored,
      eventCounts: stored.eventCounts ?? {},
      teams: stored.teams ?? {},
      providers: stored.providers ?? {},
      permissionResults: stored.permissionResults ?? {},
      lastEvents: Array.isArray(stored.lastEvents) ? stored.lastEvents : [],
    };
  } catch {
    return emptyDemandSignals();
  }
}

function incrementDemandBucket(bucket, key) {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] ?? 0) + 1;
}

function trackDemandSignal(eventName, details = {}) {
  const now = new Date().toISOString();
  const signals = readDemandSignals();
  signals.updatedAt = now;
  signals.eventCounts[eventName] = (signals.eventCounts[eventName] ?? 0) + 1;
  incrementDemandBucket(signals.teams, details.team);
  incrementDemandBucket(signals.providers, details.provider);
  incrementDemandBucket(signals.permissionResults, details.permission);
  signals.lastEvents = [{ eventName, at: now, ...details }, ...signals.lastEvents].slice(0, DEMAND_EVENT_LIMIT);

  try {
    localStorage.setItem(DEMAND_SIGNALS_KEY, JSON.stringify(signals));
  } catch {
    return;
  }

  renderDemandSignals();
}

function topDemandEntry(bucket) {
  const [name, count] = Object.entries(bucket).sort((a, b) => b[1] - a[1])[0] ?? [];
  return name ? `${name} ${count}` : "-";
}

function demandMetricCards(signals) {
  const permissionTotal = Object.values(signals.permissionResults).reduce((sum, count) => sum + count, 0);
  const metrics = [
    ["알림 저장", signals.eventCounts.ticket_reminder_saved ?? 0, topDemandEntry(signals.teams)],
    ["예매처 클릭", signals.eventCounts.provider_click ?? 0, topDemandEntry(signals.providers)],
    ["구단 필터", signals.eventCounts.calendar_filter_selected ?? 0, topDemandEntry(signals.teams)],
    ["알림 권한", permissionTotal, topDemandEntry(signals.permissionResults)],
  ];

  return html`${metrics.map(
    ([label, value, detail]) => html`
        <article>
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${detail}</small>
        </article>
      `,
  )}`;
}

function renderDemandSignals() {
  if (!demandSignalBoard || !demandSignalEvents) {
    return;
  }

  const signals = readDemandSignals();
  demandSignalBoard.innerHTML = demandMetricCards(signals);
  demandSignalEvents.innerHTML = html`
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Signals</p>
        <h3>최근 신호</h3>
      </div>
      <p class="meta">마지막 업데이트 ${new Date(signals.updatedAt).toLocaleString("ko-KR")}</p>
    </div>
    <ol>
      ${signals.lastEvents.length
        ? signals.lastEvents.map(
            (event) => html`
              <li>
                <span>${event.eventName}</span>
                <strong>${[event.team, event.provider, event.permission].filter(Boolean).join(" · ") || "-"}</strong>
                <small>${new Date(event.at).toLocaleString("ko-KR")}</small>
              </li>
            `,
          )
        : html`<li><span>대기</span><strong>-</strong><small>아직 기록된 신호가 없습니다.</small></li>`}
    </ol>
  `;
}

function exportDemandSignalSnapshot() {
  const signals = readDemandSignals();
  const blob = new Blob([JSON.stringify(signals, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kbo-tido-demand-signals-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  trackDemandSignal("signals_exported");
}

function resetDemandSignalSnapshot() {
  localStorage.removeItem(DEMAND_SIGNALS_KEY);
  renderDemandSignals();
  showToast("수요 검증 신호를 초기화했습니다.");
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
    venueType: game.home === selectedTeam ? "홈" : "원정",
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
  const watchOn = isUpcoming && Boolean(getCancelWatchGames()[gameId(game)]);

  return html`
    <div class="ticket-strip ${raw(featured ? "featured" : "")}">
      <div>
        <span>${ticketing.venueType} · ${ticketing.provider}</span>
        <strong>${ticketStatus}</strong>
        <small>${openInfo.openText}</small>
        <small>${openInfo.reminderText}</small>
      </div>
      <div class="ticket-actions">
        <a
          href="${ticketing.url}"
          target="_blank"
          rel="noopener"
          data-demand-action="provider-click"
          data-demand-provider="${ticketing.provider}"
          data-demand-team="${game.home}"
          data-demand-source="${featured ? "featured" : "list"}"
        >예매처</a>
        <button class="${raw(reminderOn ? "is-on" : "")}" type="button" data-ticket-alert="${gameId(game)}" ${raw(canClickReminder ? "" : "disabled")}>
          ${isUpcoming ? alertLabel : "종료"}
        </button>
        ${isUpcoming
          ? html`<button
              class="cancel-watch-toggle ${raw(watchOn ? "is-on" : "")}"
              type="button"
              data-cancel-watch="${gameId(game)}"
            >${watchOn ? "관심 중" : "취소표 관심"}</button>`
          : ""}
      </div>
    </div>
  `;
}

function renderCancelWatch() {
  if (!cancelWatchList) {
    return;
  }

  const watches = pruneCancelWatchGames();
  const entries = Object.entries(watches).sort((a, b) => {
    const aAt = parseKstDate(a[1].date, a[1].time)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bAt = parseKstDate(b[1].date, b[1].time)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aAt - bAt;
  });

  if (!entries.length) {
    cancelWatchList.innerHTML = `<p class="meta">저장한 관심 경기가 없습니다. 예매 캘린더에서 '취소표 관심'을 눌러 추가하세요.</p>`;
    return;
  }

  cancelWatchList.innerHTML = html`${entries.map(([key, entry]) => {
    const waiting = cancelWaitingMeta(entry.home);
    const statusClass = CANCEL_STATUS_CLASS[waiting.status] ?? "is-manual";

    return html`
      <article class="game-card cancel-watch-card">
        <time>${entry.date}<br />${entry.time}</time>
        <div class="matchup">
          <strong>${entry.away} vs ${entry.home}</strong>
          <span class="meta">${entry.location} · ${entry.provider}</span>
          <span class="cancel-status ${raw(statusClass)}">${waiting.label}</span>
        </div>
        <div class="ticket-actions">
          ${waiting.status === "official" && waiting.guideUrl
            ? html`<a
                href="${waiting.guideUrl}"
                target="_blank"
                rel="noopener"
                data-cancel-guide="${key}"
                data-demand-team="${entry.home}"
                data-demand-provider="${entry.provider}"
              >대기 서비스 안내</a>`
            : ""}
          <a
            href="${entry.url}"
            target="_blank"
            rel="noopener"
            data-cancel-provider="${key}"
            data-demand-team="${entry.home}"
            data-demand-provider="${entry.provider}"
          >예매처 열기</a>
          <button type="button" data-cancel-remove="${key}">해제</button>
        </div>
      </article>
    `;
  })}`;
}

function handleCancelWatchToggle(gameKey) {
  const game = [...(data.games ?? []), ...(data.ticketCalendar ?? [])].find((item) => gameId(item) === gameKey);

  if (!game) {
    return;
  }

  const ticketing = getTicketing(game);
  const result = toggleCancelWatch(game);

  if (result.saved) {
    trackDemandSignal("cancel_watch_saved", { team: game.home, provider: ticketing.provider });
    showToast("취소표 관심 경기로 저장했어요 · 전날 21시/당일 11시 확인 리마인더 (잔여석 보장 없음)");
  } else {
    trackDemandSignal("cancel_watch_removed", { team: game.home, provider: ticketing.provider });
    showToast("취소표 관심을 해제했습니다.");
  }

  renderTickets();
  renderTicketCalendar();
  renderCancelWatch();
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

function selectedTeamGames() {
  // 전구단 games + 캘린더 예정 경기 중 selectedTeam 이 홈/원정인 경기.
  const all = [...(data.games ?? []), ...(data.ticketCalendar ?? [])];
  return all.filter((game) => game.home === selectedTeam || game.away === selectedTeam);
}

function representativeGame() {
  // 오늘 경기 > 가장 가까운 예정 > 가장 최근 결과 순.
  const now = new Date();
  const todayKey = formatKstDateTime(now).slice(0, 5); // "MM.DD"
  const games = selectedTeamGames().map((game) => ({ game, at: parseKstDate(game.date, game.time) }));

  const today = games.find(({ at }) => at && formatKstDateTime(at).slice(0, 5) === todayKey);
  if (today) {
    return today.game;
  }
  const upcoming = games
    .filter(({ game, at }) => game.type === "upcoming" && at && at.getTime() >= now.getTime())
    .sort((a, b) => a.at - b.at)[0];
  if (upcoming) {
    return upcoming.game;
  }
  const recent = games
    .filter(({ game }) => game.type !== "upcoming")
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))[0];
  return recent?.game ?? null;
}

function normalizedLiveGames() {
  // live-game.json 신규 shape(배열) 기본, 레거시 단일 객체도 방어적으로 허용.
  if (Array.isArray(data.liveGame)) {
    return data.liveGame;
  }
  return data.liveGame && (data.liveGame.homeTeam || data.liveGame.awayTeam) ? [data.liveGame] : [];
}

function selectedLiveGame() {
  // 오늘 경기 배열에서 selectedTeam 이 홈/원정인 경기를 찾는다.
  return normalizedLiveGames().find((game) => game.homeTeam === selectedTeam || game.awayTeam === selectedTeam) ?? null;
}

function liveGameFromCalendar(game) {
  // games/캘린더 shape → liveGame 카드용 정규화. 라인스코어는 없으므로 생략.
  const isHome = game.home === selectedTeam;
  return {
    date: game.date,
    time: game.time,
    location: game.location,
    statusLabel: game.type === "upcoming" ? "다음 경기" : "최근 경기",
    state: isHome ? "홈" : "원정",
    inning: game.status,
    awayTeam: game.away,
    homeTeam: game.home,
    awayScore: null,
    homeScore: null,
    note: `${game.score} · ${game.detail}`,
    linescore: [],
  };
}

function renderLiveGame() {
  // 오늘 경기 배열에서 selectedTeam 경기를 찾고, 없으면 대표 경기로 대체.
  let game = selectedLiveGame();
  if (!game) {
    const rep = representativeGame();
    if (rep) {
      game = liveGameFromCalendar(rep);
    }
  }

  if (!game) {
    liveGamePanel.innerHTML = html`
      <span class="game-status">경기 없음</span>
      <p class="meta">${selectedTeam} 경기 데이터가 없습니다.</p>
    `;
    return;
  }

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
  return html`${rankings.map((item) => {
    // team 과 note 를 합치되, note 가 비었거나 team 과 같으면 중복/빈 구분자를 피한다.
    const extra = !compact && item.note && item.note !== item.team ? item.note : "";
    const meta = [item.team, extra].filter(Boolean).join(" · ");
    return html`
        <li>
          <span class="rank-no">${item.rank}</span>
          <span class="rank-name">${item.name}</span>
          <strong>${item.value}</strong>
          ${meta ? html`<small>${meta}</small>` : ""}
        </li>
      `;
  })}`;
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
    <tr class="${raw(team.team === selectedTeam ? "is-myteam" : "")}">
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
          <p class="meta">${player.team ? html`${player.team} · ` : ""}${player.note}</p>
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

function populateTeamSelect() {
  if (!teamSelect) {
    return;
  }

  teamSelect.innerHTML = html`${Object.keys(teamColors).map(
    (team) => html`<option value="${team}">${team}</option>`,
  )}`;
  teamSelect.value = selectedTeam;
}

function refreshSelectedTeamViews() {
  // 내 구단 변경에 영향받는 섹션 재렌더: 요약/순위표/캘린더/순위패널 + 라이브/경기.
  renderSummary();
  renderRankingPanels();
  renderTicketCalendar();
  renderLiveGame();
  renderGames(currentGameFilter());
  renderTickets();
}

function renderAll() {
  renderMeta();
  renderSummary();
  renderLiveGame();
  renderRankingPanels();
  renderGames(currentGameFilter());
  renderTickets();
  renderTicketCalendar();
  renderCancelWatch();
  renderPlayers(currentPlayerFilter());
  renderDemandSignals();
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

// 예매 탭 하위 탭(캘린더/티켓팅/취소표) — 메인 라우팅의 hidden 과 독립된 클래스 레이어.
const TICKETS_DEFAULT_TAB = "calendar";

function applyTicketsSubTab(tab) {
  document.querySelectorAll("[data-tickets-tab]").forEach((el) => {
    const match = el.dataset.ticketsTab === tab;
    if (el.tagName === "BUTTON") {
      el.classList.toggle("active", match);
      el.setAttribute("aria-selected", String(match));
    } else {
      el.classList.toggle("is-subhidden", !match);
    }
  });
}

document.querySelectorAll(".tickets-subnav [data-tickets-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    applyTicketsSubTab(button.dataset.ticketsTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

applyTicketsSubTab(TICKETS_DEFAULT_TAB);

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
  trackDemandSignal("calendar_filter_selected", { team: button.dataset.calendarFilter });
  renderTicketCalendar(button.dataset.calendarFilter);
});

teamSelect?.addEventListener("change", () => {
  setSelectedTeam(teamSelect.value);
  trackDemandSignal("team_selected", { team: selectedTeam });
  // 활성 캘린더 필터 버튼을 비워, 다음 렌더가 새 선택 팀으로 기본 필터를 잡게 한다.
  ticketCalendarFilters?.querySelectorAll("[data-calendar-filter].active").forEach((button) => {
    button.classList.remove("active");
  });
  refreshSelectedTeamViews();
});

exportDemandSignals?.addEventListener("click", exportDemandSignalSnapshot);
resetDemandSignals?.addEventListener("click", resetDemandSignalSnapshot);

function syncThemeColor(isDark) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", isDark ? "#0a0b0e" : "#eeeee8");
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

function trackNotificationPermission(permission, source) {
  trackDemandSignal("notification_permission_result", { permission, source });
}

function buildGameNotification() {
  const game = selectedLiveGame() ?? {};
  const awayScore = scoreValue(game.awayScore);
  const homeScore = scoreValue(game.homeScore);
  const matchup = game.awayTeam && game.homeTeam ? `${game.awayTeam} ${awayScore}:${homeScore} ${game.homeTeam}` : `${selectedTeam} 경기`;
  const schedule = [game.date, game.time, game.location].filter(Boolean).join(" · ");

  return {
    title: `${selectedTeam} 경기 알림`,
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
    trackNotificationPermission(permission, "ticket");
    return false;
  }

  localStorage.setItem("eaglesNotifications", "on");
  updateNotifyButton();
  await showTicketNotification(game, ticketing);
  trackNotificationPermission(permission, "ticket");
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
    trackNotificationPermission(permission, "game");
    return;
  }

  updateNotifyButton();
  trackNotificationPermission(permission, "game");
}

notifyButton?.addEventListener("click", enableNotifications);

async function enableTicketReminder(gameKey, source = "unknown") {
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
  trackDemandSignal("ticket_reminder_saved", { team: game.home, provider: ticketing.provider, source });
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

function cancelWatchSlotTime(entry, slot) {
  // KST 고정 오프셋(+09:00, DST 없음)이라 24시간 단위 이동으로 전날 슬롯을 구해도 안전하다.
  const base = parseKstDate(entry.date, slot.time);
  return base ? new Date(base.getTime() + slot.offsetDays * 24 * 60 * 60 * 1000) : null;
}

async function checkCancelWatchReminders() {
  // 확인 리마인더만 — 예매처 조회/폴링 없음 (외부 fetch 금지).
  const watches = getCancelWatchGames();
  const now = Date.now();
  const fired = [];

  for (const [key, entry] of Object.entries(watches)) {
    const firedReminders = Array.isArray(entry.firedReminders) ? entry.firedReminders : [];
    const gameStart = parseKstDate(entry.date, entry.time) ?? parseKstDate(entry.date, "23:59");

    if (!gameStart || gameStart.getTime() <= now) {
      // 경기 시작 후에는 확인 리마인더 의미가 없다. 지난 경기는 renderCancelWatch 가 정리.
      continue;
    }

    for (const slot of CANCEL_WATCH_SLOTS) {
      if (firedReminders.includes(slot.id)) {
        continue;
      }

      const slotAt = cancelWatchSlotTime(entry, slot);

      if (!slotAt || slotAt.getTime() > now) {
        continue;
      }

      firedReminders.push(slot.id);
      fired.push([key, slot.id]);

      const title = `취소표 확인 타임 · ${entry.away} vs ${entry.home}`;
      const body = `${entry.date} ${entry.time} ${entry.location} · ${entry.provider} 예매처에서 직접 확인 (잔여석 보장 없음)`;

      if (notificationSupported() && Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: "./assets/app-icon.svg",
          badge: "./assets/app-icon.svg",
          tag: `cancel-watch-${key}-${slot.id}`,
          data: {
            url: entry.url,
          },
        });
      } else {
        showToast(`${title} · 예매처에서 직접 확인 (잔여석 보장 없음)`);
      }
    }
  }

  if (fired.length) {
    // await(showNotification) 동안 토글이 일어났을 수 있으므로 최신본을 다시 읽어
    // 발송한 슬롯만 병합한다(read-modify-write 경쟁 방지 — 티켓 리마인더와 동일 패턴).
    const latest = getCancelWatchGames();

    for (const [key, slotId] of fired) {
      if (!latest[key]) {
        continue;
      }

      if (!Array.isArray(latest[key].firedReminders)) {
        latest[key].firedReminders = [];
      }

      if (!latest[key].firedReminders.includes(slotId)) {
        latest[key].firedReminders.push(slotId);
      }
    }

    saveCancelWatchGames(latest);
  }
}

document.addEventListener("click", (event) => {
  const providerLink = event.target.closest('[data-demand-action="provider-click"]');
  if (providerLink) {
    trackDemandSignal("provider_click", {
      team: providerLink.dataset.demandTeam,
      provider: providerLink.dataset.demandProvider,
      source: providerLink.dataset.demandSource,
    });
  }

  const guideLink = event.target.closest("[data-cancel-guide]");
  if (guideLink) {
    trackDemandSignal("cancel_watch_guide_click", {
      team: guideLink.dataset.demandTeam,
      provider: guideLink.dataset.demandProvider,
    });
    return;
  }

  const cancelProviderLink = event.target.closest("[data-cancel-provider]");
  if (cancelProviderLink) {
    trackDemandSignal("cancel_watch_provider_click", {
      team: cancelProviderLink.dataset.demandTeam,
      provider: cancelProviderLink.dataset.demandProvider,
    });
    return;
  }

  const removeButton = event.target.closest("[data-cancel-remove]");
  if (removeButton) {
    const removed = removeCancelWatch(removeButton.dataset.cancelRemove);

    if (removed) {
      trackDemandSignal("cancel_watch_removed", { team: removed.home, provider: removed.provider });
      showToast("취소표 관심을 해제했습니다.");
      renderTickets();
      renderTicketCalendar();
      renderCancelWatch();
    }
    return;
  }

  const watchToggle = event.target.closest("[data-cancel-watch]");
  if (watchToggle) {
    handleCancelWatchToggle(watchToggle.dataset.cancelWatch);
    return;
  }

  const button = event.target.closest("[data-ticket-alert]");

  if (!button) {
    return;
  }

  enableTicketReminder(button.dataset.ticketAlert, button.closest("#calendar") ? "calendar" : "tickets");
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
populateTeamSelect();
setActiveView(viewFromHash(), false);
loadData()
  .then(() => {
    lastUpdatedAt = data.meta.updatedAt;
    renderAll();
  })
  .catch(renderDataError);
// 취소표 컨시어지 목록은 localStorage 만 사용하므로 데이터 로드와 무관하게 즉시 렌더한다.
renderCancelWatch();
window.setInterval(checkTicketReminders, 30 * 1000);
checkTicketReminders();
window.setInterval(checkCancelWatchReminders, 30 * 1000);
checkCancelWatchReminders();
window.setInterval(pollData, POLL_INTERVAL_MS);
