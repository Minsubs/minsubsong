let data = {
  meta: {},
  summary: [],
  teamStandings: [],
  liveGame: {},
  rankings: [],
  games: [],
  players: [],
  posts: [],
};

const dataFiles = {
  meta: "./data/meta.json",
  summary: "./data/summary.json",
  teamStandings: "./data/team-standings.json",
  liveGame: "./data/live-game.json",
  rankings: "./data/player-rankings.json",
  games: "./data/games.json",
  players: "./data/players.json",
  posts: "./data/posts.json",
};

const MAX_UPCOMING_GAMES = 10;
const DATA_VERSION = "v=15";
const TICKET_REMINDER_MINUTES = 10;
const DEFAULT_VIEW = "live";
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const NOTES_STORAGE_KEY = "eaglesNotes";

const teamInitials = {
  한화: "E",
  SSG: "SS",
  두산: "D",
  롯데: "L",
  KIA: "K",
  키움: "K",
  NC: "N",
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
};

const summaryBoard = document.querySelector("#summaryBoard");
const liveGamePanel = document.querySelector("#liveGamePanel");
const rankingPanel = document.querySelector("#rankingPanel");
const rankingBoard = document.querySelector("#rankingBoard");
const teamStandingsBoard = document.querySelector("#teamStandingsBoard");
const gameList = document.querySelector("#gameList");
const featuredGame = document.querySelector("#featuredGame");
const ticketGameList = document.querySelector("#ticketGameList");
const playerGrid = document.querySelector("#playerGrid");
const feed = document.querySelector("#feed");
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

function getUserNotes() {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveUserNotes(notes) {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

function deleteUserNote(id) {
  saveUserNotes(getUserNotes().filter((note) => note.id !== id));
  renderFeed();
  showToast("메모를 삭제했어요.");
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
  const [meta, summary, teamStandings, liveGame, rankings, games, players, posts] = await Promise.all([
    fetchJson(dataFiles.meta),
    fetchJson(dataFiles.summary),
    fetchJson(dataFiles.teamStandings),
    fetchJson(dataFiles.liveGame),
    fetchJson(dataFiles.rankings),
    fetchJson(dataFiles.games),
    fetchJson(dataFiles.players),
    fetchJson(dataFiles.posts),
  ]);

  data = { meta, summary, teamStandings, liveGame, rankings, games, players, posts };
}

function renderSummary() {
  summaryBoard.innerHTML = data.summary
    .map(
      (item) => `
        <article>
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.caption}</small>
        </article>
      `,
    )
    .join("");
}

function renderGames(filter = "recent") {
  const games = filter === "all" ? data.games.filter((game) => game.type !== "upcoming") : data.games.filter((game) => game.type === filter);
  const featured = games[0] ?? data.games.find((game) => game.type !== "upcoming");

  if (!featured) {
    featuredGame.innerHTML = `<p class="meta">경기 데이터가 없습니다.</p>`;
    gameList.innerHTML = "";
    return;
  }

  featuredGame.innerHTML = `
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

  gameList.innerHTML = games
    .map(
      (game) => `
        <article class="game-card">
          <time>${game.date}<br />${game.time}</time>
          <div class="matchup">
            <strong>${game.away} vs ${game.home}</strong>
            <span class="meta">${game.location} · ${game.detail}</span>
          </div>
          <span class="chip">${game.score}</span>
        </article>
      `,
    )
    .join("");
}

function renderTickets() {
  const upcomingGames = data.games.filter((game) => game.type === "upcoming").slice(0, MAX_UPCOMING_GAMES);

  if (!upcomingGames.length) {
    ticketGameList.innerHTML = `<p class="meta">예정 경기 티켓팅 정보가 없습니다.</p>`;
    return;
  }

  ticketGameList.innerHTML = upcomingGames
    .map(
      (game) => `
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
    )
    .join("");
}

function renderTeamBadge(team) {
  const initial = teamInitials[team] ?? String(team).slice(0, 1);
  const isEagles = team === "한화" ? " is-eagles" : "";
  return `<span class="team-badge${isEagles}" aria-hidden="true">${initial}</span>`;
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

  return `
    <div class="ticket-strip ${featured ? "featured" : ""}">
      <div>
        <span>${ticketing.venueType} · ${ticketing.provider}</span>
        <strong>${ticketStatus}</strong>
        <small>${openInfo.openText}</small>
        <small>${openInfo.reminderText}</small>
      </div>
      <div class="ticket-actions">
        <a href="${ticketing.url}" target="_blank" rel="noopener">예매처</a>
        <button class="${reminderOn ? "is-on" : ""}" type="button" data-ticket-alert="${gameId(game)}" ${canClickReminder ? "" : "disabled"}>
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
    return `<p class="meta">이닝별 스코어를 준비 중입니다.</p>`;
  }

  const inningHeads = linescore.map((item) => `<th scope="col">${item.inning}</th>`).join("");
  const awayScores = linescore.map((item) => `<td>${scoreValue(item.away)}</td>`).join("");
  const homeScores = linescore.map((item) => `<td>${scoreValue(item.home)}</td>`).join("");

  return `
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

  liveGamePanel.innerHTML = `
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
  return rankings
    .map(
      (item) => `
        <li>
          <span class="rank-no">${item.rank}</span>
          <span class="rank-name">${item.name}</span>
          <strong>${item.value}</strong>
          ${compact ? "" : `<small>${item.note}</small>`}
        </li>
      `,
    )
    .join("");
}

function renderRankingPanels() {
  const featuredGroups = data.rankings.slice(0, 2);

  rankingPanel.innerHTML = featuredGroups
    .map(
      (group) => `
        <section>
          <div>
            <span class="chip">${group.scope}</span>
            <h3>${group.title}</h3>
          </div>
          <ol class="ranking-list compact">${renderRankingList(group.players, true)}</ol>
        </section>
      `,
    )
    .join("");

  teamStandingsBoard.innerHTML = `
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
          ${data.teamStandings.map(renderStandingRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  rankingBoard.innerHTML = data.rankings
    .map(
      (group) => `
        <article class="ranking-card">
          <div class="ranking-card-head">
            <span class="chip">${group.scope}</span>
            <h3>${group.title}</h3>
          </div>
          <ol class="ranking-list">${renderRankingList(group.players)}</ol>
        </article>
      `,
    )
    .join("");
}

function renderStandingRow(team) {
  return `
    <tr class="${team.isHanwha ? "is-hanwha" : ""}">
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

  playerGrid.innerHTML = players
    .map(
      (player) => `
        <article class="player-card">
          <div class="player-head">
            <span class="chip">${player.role}</span>
            <span class="number">${player.number}</span>
          </div>
          <h3>${player.name}</h3>
          <p class="meta">${player.note}</p>
          <div class="stat-line">
            ${player.stats
              .map(
                (stat) => `
                  <div>
                    <span>${stat.label}</span>
                    <strong>${stat.value}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderFeed() {
  const posts = [...getUserNotes(), ...data.posts];

  feed.innerHTML = posts
    .map(
      (post) => `
        <article>
          <header>
            <div>
              <span class="chip">${escapeHtml(post.tag)}</span>
              <strong>${escapeHtml(post.author)}</strong>
            </div>
            <span class="meta">${escapeHtml(post.time)}</span>
          </header>
          <p>${escapeHtml(post.body)}</p>
          <div class="reaction-row">
            <button type="button">중요 ${post.likes}</button>
            <button type="button">체크 ${post.replies}</button>
            ${post.id ? `<button type="button" class="note-delete" data-note-delete="${post.id}">삭제</button>` : ""}
          </div>
        </article>
      `,
    )
    .join("");
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
  renderPlayers(currentPlayerFilter());
  renderFeed();
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

document.querySelector("#postForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#postInput");
  const body = input.value.trim();

  if (!body) {
    input.focus();
    return;
  }

  const notes = getUserNotes();
  notes.unshift({
    id: `note-${Date.now()}`,
    tag: document.querySelector("#postTag").value,
    author: "민섭이",
    time: formatKstDateTime(new Date()),
    body,
    likes: 0,
    replies: 0,
  });
  saveUserNotes(notes);

  input.value = "";
  renderFeed();
  showToast("메모를 저장했어요.");
});

themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
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
  const game = data.games.find((item) => gameId(item) === gameKey);

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
    localStorage.setItem("eaglesTicketReminders", JSON.stringify(reminders));
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

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-note-delete]");

  if (!button) {
    return;
  }

  deleteUserNote(button.dataset.noteDelete);
});

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
