let data = {
  meta: {},
  summary: [],
  teamStandings: [],
  liveGame: [],
  games: [],
  ticketCalendar: [],
};

const dataFiles = {
  meta: "./data/meta.json",
  summary: "./data/summary.json",
  teamStandings: "./data/team-standings.json",
  liveGame: "./data/live-game.json",
  games: "./data/games.json",
  ticketCalendar: "./data/ticketing-calendar.json",
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

// 2025 시즌 KBO 정규시즌 최종 순위(캘린더 필터 정렬용 — 매 시즌 종료 후 갱신)
const LAST_SEASON_RANK = { LG: 1, 한화: 2, SSG: 3, 삼성: 4, NC: 5, KT: 6, 롯데: 7, KIA: 8, 두산: 9, 키움: 10 };

// UI 팀명 → 표준 KBO 코드(worker/lib/push-logic.js TEAM_ALIASES 와 동일)
const TEAM_PUSH_CODE = {
  한화: "HH", LG: "LG", SSG: "SK", 두산: "OB", KIA: "HT",
  삼성: "SS", 롯데: "LT", KT: "KT", NC: "NC", 키움: "WO",
};

// 티켓 시리얼용 보딩패스 스타일 3글자 코드 (UI 표시 전용 — TEAM_PUSH_CODE 시스템 코드와 혼용 금지).
const TEAM_SERIAL_CODE = {
  한화: "EAG", LG: "TWN", 두산: "BRS", 키움: "HRS", SSG: "LDS",
  KIA: "TGR", 삼성: "LIO", 롯데: "GNT", KT: "WIZ", NC: "DIN",
};
const STADIUM_SERIAL_CODE = {
  대전: "DJN", 잠실: "JAM", 고척: "GOC", 문학: "INC", 수원: "SWN",
  대구: "DGU", 광주: "GWJ", 사직: "SJK", 창원: "CWN", 울산: "ULS",
  포항: "POH", 청주: "CHJ",
};

// location(도시/약칭) → 실제 경기장명. 미매핑 값은 원문 폴백(제2구장/빈값 방어). 로마자 변환 안 함.
const STADIUM_NAME = {
  잠실: "잠실야구장", 고척: "고척스카이돔", 문학: "인천 SSG랜더스필드",
  수원: "수원 KT위즈파크", 대전: "대전 한화생명볼파크", 대구: "대구 삼성라이온즈파크",
  광주: "광주 기아챔피언스필드", 사직: "사직야구장", 창원: "창원 NC파크",
  울산: "울산 문수야구장", 포항: "포항야구장", 청주: "청주야구장",
};
function stadiumName(location) {
  return STADIUM_NAME[location] ?? location ?? "";
}
// 스텁(140~180px)용 축약 — 도시 접두어가 있으면 제거(예: "대전 한화생명볼파크" → "한화생명볼파크").
function stadiumShort(location) {
  const full = stadiumName(location);
  const sp = full.indexOf(" ");
  return sp > 0 ? full.slice(sp + 1) : full;
}

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
  applyTeamAccent();
}

// 선택 구단 색을 UI 에 반영: 헤더 배경 밴드(--accent-diag)는 구단 원색,
// 텍스트/버튼 액센트는 테마별 대비 보정(다크=어두운 구단색 밝게, 라이트=밝은 색 어둡게).
function tidoHexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function tidoRgbToHex(rgb) {
  return "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}
function tidoLum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function tidoContrast(a, b) {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
function readableAccent(baseHex, dark) {
  const bgLum = dark ? tidoLum([12, 13, 17]) : tidoLum([242, 236, 224]);
  const target = dark ? [255, 255, 255] : [0, 0, 0];
  const base = tidoHexToRgb(baseHex);
  for (let t = 0; t <= 1.0001; t += 0.06) {
    const cand = base.map((c, i) => c + (target[i] - c) * t);
    if (tidoContrast(tidoLum(cand), bgLum) >= 4.5) {
      return tidoRgbToHex(cand);
    }
  }
  return tidoRgbToHex(target);
}
function applyTeamAccent() {
  const color = teamColors[selectedTeam] || teamColors[DEFAULT_TEAM];
  if (!color || typeof document === "undefined") {
    return;
  }
  const dark = document.documentElement.classList.contains("dark");
  const accent = readableAccent(color.base, dark);
  const s = document.documentElement.style;
  s.setProperty("--accent", accent);
  s.setProperty("--accent-strong", accent);
  s.setProperty("--accent-2", accent);
  s.setProperty("--stamp", accent);
  s.setProperty("--ring", accent);
  s.setProperty("--accent-diag", color.base); // 헤더 배경 밴드 = 구단 원색
  s.setProperty("--team-ink", color.ink || "#ffffff"); // 헤더 텍스트(구단색 위 가독)
  s.setProperty("--grad-accent", `linear-gradient(135deg, ${accent} 0%, ${color.base} 100%)`);
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
    url: "https://ticket.interpark.com/Contents/Sports",
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
    url: "https://ticket.interpark.com/Contents/Sports",
    note: "키움 홈 예매",
    openDaysBefore: 7,
    openTime: "14:00",
    cancelWaiting: cancelWaitingInterpark,
  },
  LG: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/59",
    note: "LG 홈 예매",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
    cancelWaiting: cancelWaitingTicketlink,
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
const liveScoreboard = document.querySelector("#liveScoreboard");
const notifyTopics = document.querySelector("#notifyTopics");
const notifyInstall = document.querySelector("#notifyInstall");
const notifyPermBtn = document.querySelector("#notifyPermBtn");
const teamStandingsBoard = document.querySelector("#teamStandingsBoard");
const gameList = document.querySelector("#gameList");
const featuredGame = document.querySelector("#featuredGame");
const ticketGameList = document.querySelector("#ticketGameList");
const ticketOpenCard = document.querySelector("#ticketOpenCard");
const ticketCalendarFilters = document.querySelector("#ticketCalendarFilters");
const ticketCalendarList = document.querySelector("#ticketCalendarList");
const cancelWatchList = document.querySelector("#cancelWatchList");
const teamSelect = document.querySelector("#teamSelect");
const themeToggle = document.querySelector("#themeToggle");
const installApp = document.querySelector("#installApp");
const notifyButton = document.querySelector("#notifyButton");
const iosInstallSheet = document.querySelector("#iosInstallSheet");
const iosInstallBanner = document.querySelector("#iosInstallBanner");
const dataUpdated = document.querySelector("#dataUpdated");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const viewTriggers = document.querySelectorAll("[data-view-target]");
let deferredInstallPrompt = null;
let toastTimer = null;
let lastUpdatedAt = null;
// 예매 캘린더: 예매 중(오픈됨) 컴팩트 리스트의 '더 보기' 펼침 상태(세션 한정).
let calendarOpenExpanded = false;

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

// 스트로크 아이콘(바텀탭/헤더 종과 톤 일치) — D7 버튼 위계용. 이모지 금지.
const TIDO_ICONS = {
  ticket: '<path d="M4 8h16v3a2 2 0 0 0 0 4v1H4v-1a2 2 0 0 0 0-4z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  calendarPlus: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M12 13.5v4M10 15.5h4"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7h14v-7"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
};
function tidoIcon(name) {
  return raw(
    `<svg class="tico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TIDO_ICONS[name] || ""}</svg>`,
  );
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
  const [meta, summary, teamStandings, liveGame, games, ticketCalendar] = await Promise.all([
    fetchJson(dataFiles.meta),
    fetchJson(dataFiles.summary),
    fetchJson(dataFiles.teamStandings),
    fetchJson(dataFiles.liveGame),
    fetchJson(dataFiles.games),
    fetchJson(dataFiles.ticketCalendar),
  ]);

  data = { meta, summary, teamStandings, liveGame, games, ticketCalendar };
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
  if (!summaryBoard) return; // 홈 리디자인에서 스냅샷 제거 — 요소 없으면 no-op.
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
  const games = filter === "all" ? teamGames.filter((game) => game.type === "recent" || game.type === "upcoming") : teamGames.filter((game) => game.type === filter);
  const featured = games[0] ?? teamGames.find((game) => game.type !== "upcoming");

  if (!featured) {
    featuredGame.innerHTML = html`
      <div class="empty-state" role="status">
        <span class="empty-state__icon" aria-hidden="true">📺</span>
        <p class="empty-state__title">${selectedTeam} 경기 데이터가 없습니다</p>
        <p class="empty-state__hint">다른 필터를 선택하거나 잠시 후 다시 확인해 주세요.</p>
      </div>
    `;
    gameList.innerHTML = "";
    return;
  }

  const isUpcoming = featured.type === "upcoming";
  const featStamp = ticketDayStamp(featured);
  const featScore = isUpcoming ? "VS" : (featured.score ?? "");
  // 중계 스코어 카드: 일련번호 · ON-AIR 상태 · 대각 팀컬러 · 대형 탭형 스코어 · 절취선 · 바코드 · 스탬프
  featuredGame.innerHTML = html`
    <div class="broadcast-card__band" aria-hidden="true"></div>
    <span class="ticket-serial">${ticketSerial(featured)}</span>
    <div class="broadcast-card__statusrow">
      <span class="broadcast-status${raw(isUpcoming ? "" : " is-live")}">
        <span class="broadcast-status__dot" aria-hidden="true"></span>${featured.status}
      </span>
      <span class="broadcast-card__when">${featured.date} · ${featured.time}</span>
    </div>
    <div class="broadcast-score">
      <div class="broadcast-score__side away">
        ${renderTeamBadge(featured.away)}
        <span class="broadcast-score__team">${featured.away}</span>
        <span class="broadcast-score__role">원정</span>
      </div>
      <div class="broadcast-score__num">${featScore}</div>
      <div class="broadcast-score__side home">
        ${renderTeamBadge(featured.home)}
        <span class="broadcast-score__team">${featured.home}</span>
        <span class="broadcast-score__role">홈</span>
      </div>
    </div>
    <p class="broadcast-card__head">${featured.away} <i>vs</i> ${featured.home}</p>
    <div class="broadcast-card__perf" aria-hidden="true"></div>
    <div class="broadcast-card__foot">
      <div class="ticket-barcode kbo-barcode" aria-hidden="true">${buildBarcode(gameId(featured))}</div>
      <p class="broadcast-card__meta">${featured.location} · ${featured.detail}</p>
    </div>
    <span class="ticket-stamp broadcast-card__stamp" aria-hidden="true">${featStamp}</span>
  `;

  gameList.innerHTML = html`${games.map((game) => {
    const up = game.type === "upcoming";
    const num = up ? "VS" : (game.score ?? "");
    const mine = game.home === selectedTeam || game.away === selectedTeam ? " is-myteam" : "";
    return html`
        <article class="broadcast-game${raw(mine)}">
          <div class="broadcast-game__rail" aria-hidden="true"></div>
          <time class="broadcast-game__time" datetime="${game.date}">
            <span>${game.date}</span>
            <b>${game.time}</b>
          </time>
          <div class="broadcast-game__matchup">
            <span class="broadcast-game__teams">${game.away} <i>vs</i> ${game.home}</span>
            <span class="broadcast-game__meta">${game.location} · ${game.detail}</span>
          </div>
          <span class="broadcast-game__score${raw(up ? " is-vs" : "")}">${num}</span>
        </article>
      `;
  })}`;
}

// 경기 시작까지 남은 날(D-n) 스탬프 라벨 — 오늘=D-DAY, 지남=종료.
function ticketDayStamp(game) {
  const gameDate = parseKstDate(game.date, game.time);
  if (!gameDate) {
    return "TBD";
  }
  const startOfDay = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };
  const diffDays = Math.round((startOfDay(gameDate) - startOfDay(new Date())) / 86400000);
  if (diffDays > 0) {
    return `D-${diffDays}`;
  }
  if (diffDays === 0) {
    return "D-DAY";
  }
  return "종료";
}

// 티켓-스텁 일련번호 — 홈 ticketOpenCard 와 동일 포맷(NO. 날짜-홈팀).
function ticketSerial(game) {
  return `NO. ${(game.date || "").replace(/\./g, "")}-${game.home}`;
}

function teamSerialCode(team) {
  return TEAM_SERIAL_CODE[team] ?? String(team || "").slice(0, 3).toUpperCase();
}
function stadiumSerialCode(location) {
  return STADIUM_SERIAL_CODE[location] ?? ""; // 미매핑 경기장은 세그먼트 생략
}

// 실데이터 파생 티켓 시리얼 — YEAR-MMDD-AWAY-HOME-STADIUM (예: 2026-0718-HRS-EAG-DJN).
function ticketSerialCode(game) {
  const mmdd = String(game.date || "").replace(/\./g, "");
  const away = teamSerialCode(game.away);
  const home = teamSerialCode(game.home);
  const st = stadiumSerialCode(game.location);
  return `${seasonYear()}-${mmdd}-${away}-${home}${st ? `-${st}` : ""}`;
}

// FNV-1a 해시 — 문자열 시드를 32bit 정수로.
function tidoHashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// mulberry32 결정적 PRNG — 같은 시드 = 같은 난수열.
function tidoRng(seedInt) {
  let a = seedInt >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 경기 시드로 결정적 바코드 SVG(같은 시드=같은 패턴). orientation "h"(가로)|"v"(세로).
// fill 은 상속 프로퍼티 — svg style 의 var(--barcode) 가 rect 로 내려간다(테마 대응).
function buildBarcode(seed, orientation = "h") {
  const rand = tidoRng(tidoHashSeed(seed));
  const SPAN = 100;
  const rects = [];
  let pos = 1;
  while (pos < SPAN - 1) {
    const w = 0.7 + rand() * 2.6;
    if (pos + w > SPAN - 1) {
      break;
    }
    rects.push(
      orientation === "v"
        ? `<rect x="0" y="${pos.toFixed(2)}" width="30" height="${w.toFixed(2)}" />`
        : `<rect x="${pos.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="30" />`,
    );
    pos += w + (0.7 + rand() * 1.9);
  }
  const vb = orientation === "v" ? "0 0 30 100" : "0 0 100 30";
  return raw(
    `<svg class="kbo-barcode__svg" viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true" style="fill:var(--barcode)">${rects.join("")}</svg>`,
  );
}

function renderTickets() {
  const upcomingGames = data.games.filter((game) => game.type === "upcoming").slice(0, MAX_UPCOMING_GAMES);

  if (!upcomingGames.length) {
    ticketGameList.innerHTML = html`
      <div class="empty-state" role="status">
        <span class="empty-state__icon" aria-hidden="true">🎟️</span>
        <p class="empty-state__title">예정 경기 티켓이 없습니다</p>
        <p class="empty-state__hint">다가오는 경기가 확정되면 여기에서 예매 정보를 안내합니다.</p>
      </div>
    `;
    return;
  }

  ticketGameList.innerHTML = html`${upcomingGames.map((game) => {
    const ticketing = getTicketing(game);
    const stamp = ticketDayStamp(game);
    return html`
        <article class="ticket-stub ticket-stub--game">
          <div class="ticket-stub__main">
            <span class="ticket-serial">${ticketSerial(game)}</span>
            <span class="ticket-stub__eyebrow">${game.date} ${game.time} · ${ticketing.venueType}석 ${ticketing.provider}</span>
            <strong class="toc-matchup">${game.away} vs ${game.home}</strong>
            <p class="ticket-stub__meta">${stadiumName(game.location)} · ${game.detail}</p>
            ${renderTicketInfo(game)}
          </div>
          <div class="ticket-stub__perf" aria-hidden="true"></div>
          <div class="ticket-stub__foot">
            <div class="ticket-barcode kbo-barcode" aria-hidden="true">${buildBarcode(gameId(game))}</div>
            <div class="ticket-stub__bcrow">
              <span>${ticketing.provider}</span>
              <span>${ticketing.venueType}</span>
            </div>
          </div>
          <span class="ticket-stamp ticket-stub__stamp" aria-hidden="true">${stamp}</span>
        </article>
      `;
  })}`;
}

function calendarTeams() {
  const teams = new Set();
  for (const game of data.ticketCalendar) {
    teams.add(game.home);
    teams.add(game.away);
  }
  return [...teams].sort((a, b) => (LAST_SEASON_RANK[a] ?? 999) - (LAST_SEASON_RANK[b] ?? 999));
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

  const filtered =
    filter === "all"
      ? data.ticketCalendar
      : data.ticketCalendar.filter((game) => game.home === filter || game.away === filter);

  // ①경기일이 지난 항목 제외 — parseKstDate 기준 경기 시작 시각이 과거면 캘린더에서 뺀다.
  const now = Date.now();
  const active = filtered
    .map((game) => {
      const gameDate = parseKstDate(game.date, game.time);
      const ticketing = getTicketing(game);
      const openInfo = getTicketOpenInfo(game, ticketing);
      return { game, gameDate, ticketing, openInfo };
    })
    .filter(({ gameDate }) => gameDate instanceof Date && gameDate.getTime() >= now);

  if (!active.length) {
    ticketCalendarList.innerHTML = html`
      <div class="empty-state" role="status">
        <span class="empty-state__icon" aria-hidden="true">📅</span>
        <p class="empty-state__title">예매 캘린더가 비어 있습니다</p>
        <p class="empty-state__hint">선택한 구단의 다가오는 예매 일정이 없습니다. 다른 구단을 선택해 보세요.</p>
      </div>
    `;
    return;
  }

  // ②미오픈(아직 예매 오픈 전)은 openAt 임박순으로 최상단에 풀 스텁으로 노출.
  const unopened = active
    .filter(({ openInfo }) => !openInfo.isOpen && openInfo.openAt instanceof Date)
    .sort((a, b) => a.openInfo.openAt - b.openInfo.openAt);
  // openAt 계산이 안 되는 미오픈 항목(시간 미확정)은 뒤에 붙여 누락되지 않게 한다.
  const unopenedTbd = active.filter(({ openInfo }) => !openInfo.isOpen && !(openInfo.openAt instanceof Date));
  const unopenedOrdered = [...unopened, ...unopenedTbd];

  // ③예매 중(이미 오픈)은 경기일 임박순 정렬 후 상위 3건만 컴팩트 1줄.
  const opened = active
    .filter(({ openInfo }) => openInfo.isOpen)
    .sort((a, b) => a.gameDate - b.gameDate);
  const openedCompact = opened.slice(0, 3);
  // ④나머지 예매 중 경기는 '더 보기' 토글 안에 컴팩트 1줄로.
  const openedRest = opened.slice(3);

  const fullStub = ({ game, ticketing }) => {
    const provider = game.ticketing?.provider ?? ticketing.provider;
    const stamp = ticketDayStamp(game);
    return html`
        <article class="ticket-stub ticket-stub--calendar">
          <div class="ticket-stub__main">
            <span class="ticket-serial">${ticketSerial(game)}</span>
            <span class="ticket-stub__eyebrow">${game.date} ${game.time} · ${provider}</span>
            <strong class="toc-matchup ticket-stub__matchup">
              ${renderTeamBadge(game.away)}
              <span>${game.away}</span>
              <em class="ticket-stub__vs">vs</em>
              ${renderTeamBadge(game.home)}
              <span>${game.home}</span>
            </strong>
            ${ticketing.earlyOpenLabel
              ? html`<span class="early-open-chip">선예매 ${ticketing.earlyOpenLabel}</span>`
              : ""}
            <p class="ticket-stub__meta">${stadiumName(game.location)} · ${game.detail}</p>
            ${renderTicketInfo({ ...game, type: "upcoming" })}
          </div>
          <div class="ticket-stub__perf" aria-hidden="true"></div>
          <div class="ticket-stub__foot">
            <div class="ticket-barcode kbo-barcode" aria-hidden="true">${buildBarcode(gameId(game))}</div>
            <div class="ticket-stub__bcrow">
              <span>${provider}</span>
              <span>예매 캘린더</span>
            </div>
          </div>
          <span class="ticket-stamp ticket-stub__stamp" aria-hidden="true">${stamp}</span>
        </article>
      `;
  };

  // 예매 중 컴팩트 1줄: 매치업 · 경기일 · 예매처 링크.
  const compactRow = ({ game, ticketing }) => html`
      <li class="calendar-open-row">
        <span class="calendar-open-row__match">${game.away} vs ${game.home}</span>
        <span class="calendar-open-row__date">${game.date} ${game.time}</span>
        <a
          class="calendar-open-row__link"
          href="${ticketing.url}"
          target="_blank"
          rel="noopener"
          data-demand-action="provider-click"
          data-demand-provider="${ticketing.provider}"
          data-demand-team="${game.home}"
          data-demand-source="calendar-open"
        >${ticketing.provider}</a>
      </li>
    `;

  const openedMarkup = opened.length
    ? html`
      <section class="calendar-open" aria-label="예매 중인 경기">
        <h3 class="calendar-open__title">예매 중</h3>
        <ul class="calendar-open__list">${openedCompact.map(compactRow)}</ul>
        ${openedRest.length
          ? html`
            <button
              class="calendar-open__more"
              type="button"
              data-calendar-open-toggle
              aria-expanded="${raw(calendarOpenExpanded ? "true" : "false")}"
            >${calendarOpenExpanded ? "접기" : `예매 중인 경기 ${openedRest.length}개 더 보기`}</button>
            <ul class="calendar-open__list calendar-open__list--rest" ${raw(calendarOpenExpanded ? "" : "hidden")}>
              ${openedRest.map(compactRow)}
            </ul>
          `
          : ""}
      </section>
    `
    : "";

  ticketCalendarList.innerHTML = html`${unopenedOrdered.map(fullStub)}${openedMarkup}`;
}

// 마스코트 라틴 이니셜 1글자(원본 이글스 아이콘의 E 무드). 후속 아이콘 배선에서도 재사용.
// T·L 중복은 팀 컬러 + 팀명 병기로 구분(의도된 트레이드오프).
const TEAM_MASCOT_LETTER = {
  한화: "E", LG: "T", 두산: "D", 키움: "K", SSG: "L",
  KIA: "T", 삼성: "SL", 롯데: "G", KT: "KT", NC: "NC",
};
function renderTeamBadge(team) {
  const color = teamColors[team] ?? { base: "#4a4a4a", edge: "#262626", ink: "#ffffff" };
  const letter = TEAM_MASCOT_LETTER[team] ?? String(teamInitials[team] ?? team).slice(0, 1).toUpperCase();
  const myTeam = team === selectedTeam ? " is-myteam" : "";
  // 2글자(SL·NC)는 한 단계 작게 — 원판 안에 꽉 차되 답답하지 않게.
  const fontSize = letter.length >= 2 ? 21 : 32;
  // 플랫-볼드 레터마크: 팀 base 단색 + edge 스트로크. 그라디언트/하이라이트/글로우 없음.
  // 글자는 오프화이트 헤비(900), 원판을 꽉 채우는 존재감. (내구단) 액센트 링만.
  return html`<span class="team-crest${raw(myTeam)}" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <circle cx="24" cy="24" r="21.5" fill="${raw(color.base)}" stroke="${raw(color.edge)}" stroke-width="1.75" />
        <circle class="crest-ring" cx="24" cy="24" r="19.5" fill="none" stroke-width="1.5" />
        <text
          x="24"
          y="25.5"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="'Pretendard Variable', Pretendard, system-ui, sans-serif"
          font-size="${raw(fontSize)}"
          font-weight="900"
          fill="#fff8ef"
        >${letter}</text>
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

  mirrorDemandSignal(eventName, details);
}

// 로컬 이벤트명 → 백엔드 허용 이벤트명(worker/lib/push-logic.js ALLOWED_EVENTS) 매핑.
// 매핑 없는 이벤트는 미러링하지 않는다(allow-list, 식별자/PII 미포함).
const DEMAND_MIRROR_EVENT_MAP = {
  team_selected: "team_interest",
  cancel_watch_saved: "cancel_watch",
  notification_permission_result: "subscribe",
};

function mirrorDemandSignal(eventName, details = {}) {
  if (!pushConfigured() || typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return;
  }

  const mirroredName = DEMAND_MIRROR_EVENT_MAP[eventName];
  if (!mirroredName) {
    return;
  }

  try {
    const ev = { name: mirroredName, count: 1 };
    const code = details.team ? TEAM_PUSH_CODE[details.team] : null;
    if (code) ev.key = code; // 관심구단 코드를 집계 차원으로(≤8자)
    const payload = JSON.stringify({ events: [ev] });
    navigator.sendBeacon(`${PUSH_API_BASE}/api/events`, new Blob([payload], { type: "application/json" }));
  } catch {
    // sendBeacon 실패는 무시 — 수요 신호 미러링은 부가 기능이다.
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
  // "MM.DD HH:MM" — 날짜/시각을 공백으로 분리(점 연쇄 "07.11.11:00" 방지).
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
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

// RFC5545 UTC 타임스탬프(YYYYMMDDTHHMMSSZ).
function icsStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// TEXT 값 이스케이프(RFC5545 3.3.11): 백슬래시·세미콜론·콤마·줄바꿈.
function icsEscapeText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

// 예매 오픈용 .ics 문자열을 만드는 순수함수(외부 fetch 없음).
// openInfo.openAt(Date)이 없으면 null 을 반환한다.
function buildOpenIcs(game, ticketing, openInfo) {
  if (!(openInfo?.openAt instanceof Date)) {
    return null;
  }
  const start = icsStamp(openInfo.openAt);
  const provider = ticketing?.provider ?? "";
  const url = ticketing?.url ?? "";
  const summary = icsEscapeText(`[예매오픈] ${game.away} vs ${game.home} (${provider})`);
  const description = icsEscapeText(url);
  const uid = `${start}-${game.away}-${game.home}@kbo-tido`.replace(/\s+/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KBO TIDO//Ticket Open//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${icsEscapeText(uid)}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${start}`,
    "DURATION:PT10M",
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "TRIGGER:-PT10M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// buildOpenIcs 결과를 Blob 으로 내려받는다(외부 fetch 없음 — 클라 생성).
function downloadOpenIcs(game, ticketing, openInfo) {
  const ics = buildOpenIcs(game, ticketing, openInfo);
  if (!ics) {
    showToast("예매 오픈 시간이 확정되지 않아 캘린더 파일을 만들지 못했습니다.");
    return;
  }
  const stamp = (game.date || "").replace(/\./g, "");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `kbo-tido-open-${stamp}-${game.home}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  trackDemandSignal("calendar_ics_added", { team: game.home, provider: ticketing?.provider });
  showToast("예매 오픈 일정을 캘린더 파일로 내려받았어요.");
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
          class="toc-cta"
          href="${ticketing.url}"
          target="_blank"
          rel="noopener"
          data-demand-action="provider-click"
          data-demand-provider="${ticketing.provider}"
          data-demand-team="${game.home}"
          data-demand-source="${featured ? "featured" : "list"}"
        >${tidoIcon("ticket")}<span>예매처</span></a>
        <div class="tia-icons">
          <button
            class="toc-iconbtn ${raw(reminderOn ? "is-on" : "")}"
            type="button"
            data-ticket-alert="${gameId(game)}"
            ${raw(canClickReminder ? "" : "disabled")}
            aria-pressed="${raw(reminderOn ? "true" : "false")}"
            aria-label="${raw(isUpcoming ? (reminderOn ? "알림 켜짐" : "알림 받기") : "예매 종료")}"
            title="${raw(isUpcoming ? alertLabel : "종료")}"
          >${tidoIcon("bell")}</button>
          ${isUpcoming && openInfo.openAt instanceof Date
            ? html`<button class="toc-iconbtn toc-iconbtn--ghost" type="button" data-add-ics="${gameId(game)}" aria-label="캘린더에 추가" title="캘린더에 추가">${tidoIcon("calendarPlus")}</button>`
            : ""}
          ${isUpcoming
            ? html`<button
                class="toc-iconbtn toc-iconbtn--ghost ${raw(watchOn ? "is-on" : "")}"
                type="button"
                data-cancel-watch="${gameId(game)}"
                aria-pressed="${raw(watchOn ? "true" : "false")}"
                aria-label="${raw(watchOn ? "취소표 관심 해제" : "취소표 관심")}"
                title="${raw(watchOn ? "관심 중" : "취소표 관심")}"
              >${tidoIcon("bookmark")}</button>`
            : ""}
        </div>
      </div>
    </div>
  `;
}

// 홈 카운트다운 카드 — 다음 예매 오픈이 가장 가까운 내 구단 경기 1개.
let ticketOpenCountdownTimer = null;
let ticketOpenCountdownTarget = null;

function pickNextTicketOpenGame() {
  // selectedTeam 이 홈/원정으로 참여하는 다가오는(upcoming) 경기 중,
  // 예매 오픈 시각이 아직 안 열렸으면 우선, 그 안에서 가장 가까운 1개.
  const now = Date.now();
  const candidates = selectedTeamGames()
    .filter((game) => game.type === "upcoming")
    .map((game) => {
      const ticketing = getTicketing(game);
      const openInfo = getTicketOpenInfo(game, ticketing);
      return { game, ticketing, openInfo };
    })
    .filter(({ openInfo }) => openInfo.openAt instanceof Date);

  // 아직 안 열린 경기 우선(오픈 임박 순), 없으면 이미 열린 경기 중 오픈 최신 순.
  const upcoming = candidates
    .filter(({ openInfo }) => !openInfo.isOpen)
    .sort((a, b) => a.openInfo.openAt - b.openInfo.openAt)[0];
  if (upcoming) {
    return upcoming;
  }
  return candidates
    .filter(({ openInfo }) => openInfo.isOpen && openInfo.openAt.getTime() <= now)
    .sort((a, b) => b.openInfo.openAt - a.openInfo.openAt)[0] ?? null;
}

function upcomingTicketOpenGames() {
  // selectedTeam 의 다가오는(upcoming) 경기 중 예매 오픈 시각이 계산되는 것 전부,
  // 오픈 임박 순 정렬. pickNextTicketOpenGame 과 동일 후보 풀을 공유한다.
  return selectedTeamGames()
    .filter((game) => game.type === "upcoming")
    .map((game) => {
      const ticketing = getTicketing(game);
      const openInfo = getTicketOpenInfo(game, ticketing);
      return { game, ticketing, openInfo };
    })
    .filter(({ openInfo }) => openInfo.openAt instanceof Date)
    .sort((a, b) => a.openInfo.openAt - b.openInfo.openAt);
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hh = String(Math.floor((total % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return { days, clock: `${hh}:${mm}:${ss}` };
}

// 인라인 단위 카운트다운 HTML — "10시간 57분 45초"(단위=작고 옅은 span). 24h+ 는 "2일 10시간 57분".
// 숫자는 tabular-nums(.toc-countdown)로 매초 떨림 방지. XSS 위험 없음(숫자+고정 단위).
function countdownInnerHtml(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const seg = (n, unit) => `${String(n).padStart(2, "0")}<span class="toc-cd-u">${unit}</span>`;
  if (days > 0) {
    return `${days}<span class="toc-cd-u">일</span> ${seg(hours, "시간")} ${seg(minutes, "분")}`;
  }
  return `${seg(hours, "시간")} ${seg(minutes, "분")} ${seg(seconds, "초")}`;
}

function tickTicketOpenCountdown() {
  if (!ticketOpenCard || !ticketOpenCountdownTarget) {
    return;
  }

  const el = ticketOpenCard.querySelector(".toc-countdown");
  if (!el) {
    return;
  }

  const remain = ticketOpenCountdownTarget.getTime() - Date.now();
  if (remain <= 0) {
    // 오픈 시각 도달 → 상태 전환 위해 카드 재렌더(인터벌 자동 정리).
    renderTicketOpenCard();
    return;
  }

  el.innerHTML = countdownInnerHtml(remain);

  // 오픈 ≤ 1시간이면 임박 강조(임계점을 카운트다운 도중 넘으면 켜진다).
  const soon = remain <= 60 * 60 * 1000;
  el.classList.toggle("is-soon", soon);
  ticketOpenCard.classList.toggle("is-soon", soon);
}

function stopTicketOpenCountdown() {
  if (ticketOpenCountdownTimer) {
    window.clearInterval(ticketOpenCountdownTimer);
    ticketOpenCountdownTimer = null;
  }
}

function startTicketOpenCountdown(target) {
  stopTicketOpenCountdown();
  ticketOpenCountdownTarget = target;
  if (!target || document.hidden) {
    return;
  }
  tickTicketOpenCountdown();
  ticketOpenCountdownTimer = window.setInterval(tickTicketOpenCountdown, 1000);
}

function renderTicketOpenCard() {
  if (!ticketOpenCard) {
    return;
  }

  stopTicketOpenCountdown();
  ticketOpenCountdownTarget = null;

  const pick = pickNextTicketOpenGame();

  if (!pick) {
    ticketOpenCard.classList.remove("is-soon", "toc-open", "has-upcoming");
    ticketOpenCard.innerHTML = html`
      <div class="toc-empty">
        <span class="toc-eyebrow">다음 예매 오픈</span>
        <p class="meta">${selectedTeam} 의 다가오는 예매 오픈 경기가 없습니다. 예매 캘린더에서 일정을 확인하세요.</p>
      </div>
    `;
    return;
  }

  const { game, ticketing, openInfo } = pick;
  const reminderOn = Boolean(getTicketReminders()[gameId(game)]);
  const isOpen = openInfo.isOpen;
  const remain = openInfo.openAt.getTime() - Date.now();
  const soon = !isOpen && remain <= 60 * 60 * 1000;
  const alertLabel = reminderOn ? "알림 설정됨" : openInfo.canRemind ? "알림 받기" : "오픈 임박";
  const canClickReminder = reminderOn || openInfo.canRemind;
  const { days } = formatCountdown(Math.max(0, remain));
  const countdownText = isOpen ? "지금 예매 중" : countdownInnerHtml(Math.max(0, remain));

  ticketOpenCard.classList.toggle("is-soon", soon);
  ticketOpenCard.classList.toggle("toc-open", isOpen);

  const serialCode = ticketSerialCode(game);
  const openWhen = openInfo.openAt instanceof Date ? formatKstDateTime(openInfo.openAt) : "시간 확인 필요";
  const stampLabel = isOpen ? "예매중" : `D-${days}`;

  // 다가오는 오픈 미니 리스트 — 히어로로 뽑힌 경기(pickGameId)는 제외한 다음 N개.
  const pickGameId = gameId(game);
  const now = Date.now();
  const upcomingList = upcomingTicketOpenGames()
    .filter((entry) => gameId(entry.game) !== pickGameId && !entry.openInfo.isOpen)
    .slice(0, 3);

  const upcomingMarkup = upcomingList.length
    ? html`
      <div class="toc-upcoming" aria-label="다가오는 예매 오픈">
        <span class="toc-upcoming__eyebrow">다가오는 오픈</span>
        <ul class="toc-upcoming__list">
          ${upcomingList.map(({ game: g, openInfo: oi }) => {
            const gReminderOn = Boolean(getTicketReminders()[gameId(g)]);
            const gIsOpen = oi.isOpen;
            const gRemain = oi.openAt.getTime() - now;
            const gDays = Math.max(0, Math.ceil(gRemain / 86400000));
            const gCanClick = gReminderOn || oi.canRemind;
            const dLabel = gIsOpen ? "예매중" : gDays > 0 ? `D-${gDays}` : "임박";
            const gAlertLabel = gReminderOn ? "알림 설정됨" : gIsOpen ? "오픈됨" : oi.canRemind ? "알림" : "임박";
            return html`
              <li class="toc-upcoming__item">
                <span class="toc-upcoming__date">${g.date}</span>
                <span class="toc-upcoming__match">${g.away} vs ${g.home}</span>
                <span class="toc-upcoming__dn ${raw(gIsOpen ? "is-open" : "")}">${dLabel}</span>
                <button
                  class="toc-upcoming__alert ${raw(gReminderOn ? "is-on" : "")}"
                  type="button"
                  data-ticket-alert="${gameId(g)}"
                  ${raw(gCanClick ? "" : "disabled")}
                  aria-pressed="${raw(gReminderOn ? "true" : "false")}"
                  aria-label="${raw(gReminderOn ? "알림 켜짐" : "알림")}"
                  title="${gAlertLabel}"
                >${tidoIcon("bell")}</button>
              </li>
            `;
          })}
        </ul>
      </div>
    `
    : "";

  ticketOpenCard.classList.toggle("has-upcoming", upcomingList.length > 0);

  // 실물 티켓 구조: 본체(.toc-ticket__body) + 절취선(.toc-ticket__rip) + 스텁(.toc-ticket__stub).
  // 데스크톱은 3열(본체|세로절취선|세로바코드 스텁), 모바일은 세로 스택(가로 바코드).
  ticketOpenCard.innerHTML = html`
    <div class="toc-ticket">
      <div class="toc-ticket__body">
        <span class="ticket-stamp" aria-hidden="true">${stampLabel}</span>
        <p class="toc-micro">KBO TIDO · TICKET OPEN REMINDER</p>
        <span class="toc-eyebrow">다음 예매 오픈</span>
        <strong class="toc-matchup">${game.away} vs ${game.home}</strong>
        ${ticketing.earlyOpenLabel ? html`<span class="early-open-chip">선예매 ${ticketing.earlyOpenLabel}</span>` : ""}
        <div class="toc-metas">
          <p class="toc-meta"><span>${game.date} ${game.time}</span><span>${stadiumName(game.location)}</span></p>
          <p class="toc-meta toc-meta--sub"><span>${ticketing.provider}</span><span>예매 오픈 ${openWhen}</span></p>
        </div>
        <div class="toc-count">
          <div class="toc-countdown ${raw(soon ? "is-soon" : "")} ${raw(isOpen ? "toc-open" : "")}" aria-live="polite">${raw(countdownText)}</div>
        </div>
        <div class="toc-actions">
          <a
            class="toc-cta"
            href="${ticketing.url}"
            target="_blank"
            rel="noopener"
            data-demand-action="provider-click"
            data-demand-provider="${ticketing.provider}"
            data-demand-team="${game.home}"
            data-demand-source="home-card"
          >${tidoIcon("ticket")}<span>예매처</span></a>
          <div class="toc-iconbar">
            <button
              class="toc-iconbtn ${raw(reminderOn ? "is-on" : "")}"
              type="button"
              data-ticket-alert="${gameId(game)}"
              ${raw(canClickReminder ? "" : "disabled")}
              aria-pressed="${raw(reminderOn ? "true" : "false")}"
              aria-label="${raw(reminderOn ? "알림 켜짐" : "알림 받기")}"
              title="${alertLabel}"
            >${tidoIcon("bell")}</button>
            ${openInfo.openAt instanceof Date
              ? html`<button class="toc-iconbtn toc-iconbtn--ghost" type="button" data-add-ics="${gameId(game)}" aria-label="캘린더에 추가" title="캘린더에 추가">${tidoIcon("calendarPlus")}</button>`
              : ""}
            <button class="toc-iconbtn toc-iconbtn--ghost" type="button" data-share-game="${gameId(game)}" aria-label="공유" title="공유">${tidoIcon("share")}</button>
          </div>
        </div>
      </div>
      <div class="toc-ticket__rip" aria-hidden="true"></div>
      <aside class="toc-ticket__stub" aria-label="티켓 스텁">
        <div class="toc-stub__code">
          <div class="toc-stub__bars toc-stub__bars--v">${buildBarcode(serialCode, "v")}</div>
          <div class="toc-stub__bars toc-stub__bars--h">${buildBarcode(serialCode, "h")}</div>
        </div>
        <dl class="toc-stub__fields">
          <div><dt>경기장</dt><dd>${stadiumShort(game.location)}</dd></div>
          <div><dt>일시</dt><dd>${game.date} ${game.time}</dd></div>
          <div><dt>예매처</dt><dd>${ticketing.provider}</dd></div>
          <div><dt>오픈</dt><dd>${openWhen}</dd></div>
        </dl>
        <span class="toc-stub__serial">NO. ${serialCode}</span>
      </aside>
    </div>
    ${upcomingMarkup}
  `;

  if (!isOpen) {
    startTicketOpenCountdown(openInfo.openAt);
  }
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
    cancelWatchList.innerHTML = html`
      <div class="empty-state" role="status">
        <span class="empty-state__icon" aria-hidden="true">🎫</span>
        <p class="empty-state__title">저장한 관심 경기가 없습니다</p>
        <p class="empty-state__hint">예매 캘린더에서 '취소표 관심'을 눌러 경기를 추가하면 확인 리마인더를 받습니다.</p>
      </div>
    `;
    return;
  }

  cancelWatchList.innerHTML = html`${entries.map(([key, entry]) => {
    const waiting = cancelWaitingMeta(entry.home);
    const statusClass = CANCEL_STATUS_CLASS[waiting.status] ?? "is-manual";
    const stamp = ticketDayStamp(entry);

    return html`
      <article class="ticket-stub ticket-stub--cancel">
        <div class="ticket-stub__main">
          <span class="ticket-serial">${ticketSerial(entry)}</span>
          <span class="ticket-stub__eyebrow">${entry.date} ${entry.time} · ${entry.provider}</span>
          <strong class="toc-matchup">${entry.away} vs ${entry.home}</strong>
          <p class="ticket-stub__meta">${stadiumName(entry.location)} · 취소표 컨시어지</p>
          <span class="cancel-status ${raw(statusClass)}">${waiting.label}</span>
        </div>
        <div class="ticket-stub__perf" aria-hidden="true"></div>
        <div class="ticket-stub__foot">
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
          <div class="ticket-stub__bcrow">
            <span>${entry.provider}</span>
            <span>취소표 컨시어지</span>
          </div>
        </div>
        <span class="ticket-stamp ticket-stub__stamp" aria-hidden="true">${stamp}</span>
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
  liveGamePanel.removeAttribute("aria-busy");
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
      <div class="empty-state empty-state--inline" role="status">
        <span class="empty-state__icon" aria-hidden="true">⚾</span>
        <p class="empty-state__title">예정된 경기 없음</p>
        <p class="empty-state__hint">${selectedTeam} 의 오늘 경기 데이터가 없습니다.</p>
      </div>
    `;
    return;
  }

  // 진짜 컴팩트 1줄 스트립: 미니 배지 + 원정 / 스코어 / 홈 + 상태칩.
  // line-score / note 는 의도적으로 렌더하지 않는다(컴팩트 요구).
  const hasScore = game.awayScore !== null && game.awayScore !== undefined;

  liveGamePanel.innerHTML = html`
    <div class="hss-row">
      <span class="hss-status">${game.statusLabel}</span>
      <div class="hss-side hss-side--away">
        ${renderTeamBadge(game.awayTeam)}
        <span class="hss-team">${game.awayTeam}</span>
        <b class="hss-score ${raw(hasScore ? "" : "is-pending")}">${scoreValue(game.awayScore)}</b>
      </div>
      <span class="hss-vs" aria-hidden="true">${hasScore ? game.inning || "VS" : "VS"}</span>
      <div class="hss-side hss-side--home">
        <b class="hss-score ${raw(hasScore ? "" : "is-pending")}">${scoreValue(game.homeScore)}</b>
        <span class="hss-team">${game.homeTeam}</span>
        ${renderTeamBadge(game.homeTeam)}
      </div>
      <span class="hss-meta">${game.date} · ${game.location}</span>
    </div>
  `;
}

// 홈 실시간 스코어보드 — 지금 "진행 중(live)"인 경기만 점수 + 회차(몇 회).
function renderLiveScoreboard() {
  if (!liveScoreboard) {
    return;
  }
  const live = normalizedLiveGames().filter((game) => game.status === "live");
  if (!live.length) {
    liveScoreboard.innerHTML = html`
      <div class="lsb-head">
        <span class="eyebrow">Live</span>
        <span class="meta">진행 중</span>
      </div>
      <div class="empty-state empty-state--inline" role="status">
        <span class="empty-state__icon" aria-hidden="true">⚾</span>
        <p class="empty-state__hint">지금 진행 중인 경기가 없습니다. 일정·결과 탭에서 오늘 경기를 확인하세요.</p>
      </div>
    `;
    return;
  }
  liveScoreboard.innerHTML = html`
    <div class="lsb-head">
      <span class="eyebrow lsb-live-eyebrow">Live</span>
      <span class="meta">진행 중인 경기</span>
    </div>
    <div class="lsb-list">
      ${live.map((game) => {
        const mine = game.homeTeam === selectedTeam || game.awayTeam === selectedTeam;
        return html`
          <div class="lsb-game is-live ${raw(mine ? "is-myteam" : "")}">
            <span class="lsb-inning">${game.inning}</span>
            <div class="lsb-team lsb-team--away">
              ${renderTeamBadge(game.awayTeam)}<span class="lsb-name">${game.awayTeam}</span>
            </div>
            <b class="lsb-score">${scoreValue(game.awayScore)}</b>
            <span class="lsb-colon" aria-hidden="true">:</span>
            <b class="lsb-score">${scoreValue(game.homeScore)}</b>
            <div class="lsb-team lsb-team--home">
              <span class="lsb-name">${game.homeTeam}</span>${renderTeamBadge(game.homeTeam)}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

// 알림 센터(더보기) — 카테고리 opt-in 토글(로컬 저장). 실제 발송은 백엔드(X0) 도입 후.
const PUSH_TOPICS_KEY = "eaglesPushTopics";
const NOTIFY_TOPICS = [
  { key: "ticket_open", label: "예매 오픈 임박", desc: "내 구단 예매 오픈 직전 알림" },
  { key: "cancel_window", label: "취소표 타임", desc: "공식 취소표 대기 안내 리마인더" },
  { key: "weather_cancel", label: "우천 취소", desc: "경기 취소·지연 공지" },
  { key: "game_result", label: "경기 결과", desc: "내 구단 경기 종료 결과" },
];
function readPushTopics() {
  try {
    const t = JSON.parse(localStorage.getItem(PUSH_TOPICS_KEY) ?? "{}");
    return t && typeof t === "object" ? t : {};
  } catch {
    return {};
  }
}
function writePushTopics(topics) {
  try {
    localStorage.setItem(PUSH_TOPICS_KEY, JSON.stringify(topics));
  } catch {
    // localStorage 비활성 — 세션 한정.
  }
}
function renderNotifyCenter() {
  if (!notifyTopics) {
    return;
  }
  const topics = readPushTopics();
  notifyTopics.innerHTML = html`${NOTIFY_TOPICS.map((topic) => {
    const on = topics[topic.key] === true;
    return html`
      <button
        type="button"
        class="notify-topic ${raw(on ? "is-on" : "")}"
        role="switch"
        aria-checked="${raw(on ? "true" : "false")}"
        data-notify-topic="${topic.key}"
      >
        <span class="notify-topic__main">
          <strong>${topic.label}</strong>
          <small>${topic.desc}</small>
        </span>
        <span class="notify-topic__sw" aria-hidden="true"></span>
      </button>
    `;
  })}`;

  if (notifyPermBtn) {
    if (!notificationSupported()) {
      notifyPermBtn.hidden = true;
    } else {
      notifyPermBtn.hidden = false;
      const perm = Notification.permission;
      notifyPermBtn.textContent = perm === "granted" ? "알림 허용됨" : perm === "denied" ? "OS 설정에서 켜기" : "알림 켜기";
      notifyPermBtn.disabled = perm === "denied";
    }
  }
  if (notifyInstall) {
    notifyInstall.innerHTML =
      isIosDevice() && !isStandaloneDisplay()
        ? html`<button type="button" class="secondary-button" data-ios-install-open>홈 화면에 추가 (iOS 설치)</button>`
        : "";
  }
}

function renderRankingPanels() {
  // 순위 탭의 teamStandingsBoard 는 계속 렌더해야 한다(회귀 방지).
  const standings = data.teamStandings ?? [];
  if (!standings.length) {
    teamStandingsBoard.innerHTML = html`
      <div class="empty-state" role="status">
        <span class="empty-state__icon" aria-hidden="true">📋</span>
        <p class="empty-state__title">순위 데이터 없음</p>
        <p class="empty-state__hint">KBO 팀 순위를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      </div>
    `;
  } else {
    teamStandingsBoard.innerHTML = html`
      <div class="standings-broadcast" role="table" aria-label="KBO 전체 팀 순위">
        <div class="standings-broadcast__head" role="row" aria-hidden="true">
          <span class="sb-col sb-col--rank">#</span>
          <span class="sb-col sb-col--team">TEAM</span>
          <span class="sb-col sb-col--num">승</span>
          <span class="sb-col sb-col--num">패</span>
          <span class="sb-col sb-col--num">무</span>
          <span class="sb-col sb-col--pct">승률</span>
          <span class="sb-col sb-col--gb">게임차</span>
          <span class="sb-col sb-col--streak">흐름</span>
        </div>
        <div class="standings-broadcast__body">
          ${standings.map(renderStandingRow)}
        </div>
      </div>
    `;
  }
}

function renderStandingRow(team) {
  const isMine = team.team === selectedTeam;
  // 승률(0~1)을 퍼포먼스 바 채움으로. 파싱 실패 시 0.
  const pctNum = Number.parseFloat(team.pct);
  const fill = Number.isFinite(pctNum) ? Math.max(0, Math.min(1, pctNum)) : 0;
  // 흐름: W=상승, L=하락.
  const streak = String(team.streak ?? "").trim();
  const streakDir = streak.startsWith("W") ? "up" : streak.startsWith("L") ? "down" : "flat";
  return html`
    <div class="standings-broadcast__row${raw(isMine ? " is-myteam" : "")}" role="row"${raw(isMine ? ' aria-current="true"' : "")}>
      <span class="sb-col sb-col--rank" role="cell"><span class="rank-pill">${team.rank}</span></span>
      <span class="sb-col sb-col--team" role="cell">
        <span class="standing-team">
          ${renderTeamBadge(team.team)}
          <span class="standing-team__name">${team.team}</span>
        </span>
      </span>
      <span class="sb-col sb-col--num" role="cell">${team.wins}</span>
      <span class="sb-col sb-col--num" role="cell">${team.losses}</span>
      <span class="sb-col sb-col--num" role="cell">${team.draws}</span>
      <span class="sb-col sb-col--pct" role="cell">
        <span class="sb-pct">
          <span class="sb-pct__val">${team.pct}</span>
          <span class="perf-bar" aria-hidden="true"><span class="perf-bar__fill" style="width:${raw((fill * 100).toFixed(1))}%"></span></span>
        </span>
      </span>
      <span class="sb-col sb-col--gb" role="cell">${team.gamesBehind}</span>
      <span class="sb-col sb-col--streak sb-streak--${raw(streakDir)}" role="cell">
        <span class="sb-streak">${streak || "-"}</span>
      </span>
    </div>
  `;
}

function renderMeta() {
  dataUpdated.textContent = `데이터 기준: ${data.meta.updatedAt}. ${data.meta.note}`;
}

function currentGameFilter() {
  return document.querySelector("[data-game-filter].active")?.dataset.gameFilter ?? "recent";
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
  renderTicketOpenCard();
}

function renderAll() {
  renderMeta();
  renderSummary();
  renderLiveGame();
  renderLiveScoreboard();
  renderRankingPanels();
  renderGames(currentGameFilter());
  renderTickets();
  renderTicketCalendar();
  renderCancelWatch();
  renderTicketOpenCard();
  renderNotifyCenter();
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
  if (summaryBoard) {
    summaryBoard.innerHTML = `
      <article>
        <span>데이터 오류</span>
        <strong>확인 필요</strong>
        <small>로컬 서버로 열어주세요</small>
      </article>
    `;
  }
  featuredGame.innerHTML = dataErrorCardHtml("경기 정보를 불러오지 못했습니다");
  ticketGameList.innerHTML = dataErrorCardHtml("티켓팅 정보를 불러오지 못했습니다");
  liveGamePanel.innerHTML = dataErrorCardHtml("실시간 경기 데이터를 불러오지 못했습니다");
  teamStandingsBoard.innerHTML = dataErrorCardHtml("KBO 팀 순위 데이터를 불러오지 못했습니다");
}

// 오류 상태 표준 카드 — .empty-state--error + 다시 시도(reload) 버튼.
function dataErrorCardHtml(title) {
  return `
    <div class="empty-state empty-state--error" role="alert">
      <span class="empty-state__icon" aria-hidden="true">⚠️</span>
      <p class="empty-state__title">${title}</p>
      <p class="empty-state__hint">잠시 후 다시 시도해 주세요.</p>
      <button type="button" class="empty-state__retry" data-retry-data-load>다시 시도</button>
    </div>
  `;
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
    const buttons = document.querySelectorAll("[data-game-filter]");
    setActiveButton(buttons, button);
    buttons.forEach((b) => b.setAttribute("aria-selected", b === button ? "true" : "false"));
    renderGames(button.dataset.gameFilter);
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
  subscribeToPush(); // 팀 변경 → 서버 topics 재동기화
});

// 알림 센터 — 카테고리 토글(로컬), 권한 버튼, iOS 설치
notifyTopics?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-notify-topic]");
  if (!btn) return;
  const topics = readPushTopics();
  const key = btn.dataset.notifyTopic;
  topics[key] = !(topics[key] === true);
  writePushTopics(topics);
  trackDemandSignal("notify_topic_toggle", { topic: key });
  renderNotifyCenter();
  subscribeToPush(); // 서버 topics 재동기화(게이트: 권한/설정 시에만 실제 POST)
});
notifyPermBtn?.addEventListener("click", async () => {
  await enableNotifications();
  updateNotifyButton();
  renderNotifyCenter();
});
notifyInstall?.addEventListener("click", (event) => {
  if (event.target.closest("[data-ios-install-open]")) {
    openIosInstallSheet();
  }
});

function syncThemeColor(isDark) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", isDark ? "#0c0d11" : "#f2ece0");
  }
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.classList.toggle("dark");
  syncThemeColor(isDark);
  applyTeamAccent(); // 테마 바뀌면 구단 액센트 대비 재보정
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
  // 안드로이드/데스크톱 Chrome: 네이티브 설치 prompt.
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installApp.hidden = true;
    return;
  }

  // iOS: beforeinstallprompt 가 없으므로 "홈 화면에 추가" 안내 시트를 연다.
  if (isIosDevice()) {
    openIosInstallSheet();
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installApp.hidden = true;
  if (iosInstallBanner) {
    iosInstallBanner.classList.add("ios-off");
  }
  closeIosInstallSheet();
});

// ----- iOS 설치 안내 -----
// iOS standalone PWA 에서만 향후 Web Push 가 가능하므로 "설치 = 도달률".
// iOS Safari 는 beforeinstallprompt 를 발화하지 않아 별도 안내 경로가 필요하다.
const IOS_INSTALL_DISMISS_KEY = "eaglesIosInstallHintDismissed";
let iosSheetLastFocus = null;

function isIosDevice(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0) {
  if (/iphone|ipad|ipod/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ 는 데스크톱 Mac UA 로 위장 → 터치 포인트로 식별.
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

function isStandaloneDisplay() {
  const matchesDisplayMode =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return Boolean(matchesDisplayMode || navigator.standalone === true);
}

function isIosSafari(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0) {
  // CriOS=Chrome, FxiOS=Firefox, EdgiOS/OPiOS/GSA=기타 in-app/브라우저: 홈화면 추가 경로가 다르다.
  return isIosDevice(ua, maxTouchPoints) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
}

function shouldShowIosInstall({ ios, standalone }) {
  return Boolean(ios && !standalone);
}

function iosInstallDismissed() {
  try {
    return localStorage.getItem(IOS_INSTALL_DISMISS_KEY) === "1";
  } catch {
    // localStorage 비활성: 매 방문 노출을 막기 위해 닫힌 것으로 간주한다.
    return true;
  }
}

function dismissIosInstallBanner() {
  if (iosInstallBanner) {
    iosInstallBanner.classList.add("ios-off");
  }
  try {
    localStorage.setItem(IOS_INSTALL_DISMISS_KEY, "1");
  } catch {
    // 저장 불가 환경은 세션 한정으로만 닫힌다.
  }
}

function focusableInSheet() {
  if (!iosInstallSheet) {
    return [];
  }
  return [...iosInstallSheet.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
}

function onIosSheetKeydown(event) {
  if (event.key === "Escape") {
    closeIosInstallSheet();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const focusable = focusableInSheet();
  if (focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openIosInstallSheet() {
  if (!iosInstallSheet) {
    return;
  }
  // 비-Safari iOS(Chrome 등)는 "홈 화면에 추가" 경로가 없어 Safari 안내 카피를 켠다.
  iosInstallSheet.classList.toggle("needs-safari", isIosDevice() && !isIosSafari());
  iosSheetLastFocus = document.activeElement;
  iosInstallSheet.hidden = false;
  document.addEventListener("keydown", onIosSheetKeydown);
  const focusable = focusableInSheet();
  (focusable[0] ?? iosInstallSheet).focus();
}

function closeIosInstallSheet() {
  if (!iosInstallSheet || iosInstallSheet.hidden) {
    return;
  }
  iosInstallSheet.hidden = true;
  document.removeEventListener("keydown", onIosSheetKeydown);
  if (iosSheetLastFocus && typeof iosSheetLastFocus.focus === "function") {
    iosSheetLastFocus.focus();
  }
  iosSheetLastFocus = null;
}

function updateInstallAffordance() {
  const showIos = shouldShowIosInstall({ ios: isIosDevice(), standalone: isStandaloneDisplay() });
  // iOS Safari 계열은 beforeinstallprompt 가 없어 버튼이 안내 시트를 연다.
  if (installApp && showIos) {
    installApp.hidden = false;
  }
  if (iosInstallBanner) {
    // .hidden 은 뷰 라우터(setActiveView)가 소유하므로 게이팅은 ios-off 클래스로 한다.
    iosInstallBanner.classList.toggle("ios-off", !(showIos && !iosInstallDismissed()));
  }
}

iosInstallBanner?.querySelector("[data-ios-install-open]")?.addEventListener("click", openIosInstallSheet);
iosInstallBanner?.querySelector("[data-ios-install-dismiss]")?.addEventListener("click", dismissIosInstallBanner);
iosInstallSheet
  ?.querySelectorAll("[data-ios-install-close], [data-ios-install-dismiss-sheet]")
  .forEach((element) => element.addEventListener("click", closeIosInstallSheet));

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
  // 종 아이콘 버튼 — textContent 대신 상태 클래스 + aria-label 만 갱신(아이콘 보존).
  const denied = Notification.permission === "denied";
  const on = Notification.permission === "granted" && localStorage.getItem("eaglesNotifications") === "on";
  notifyButton.disabled = denied;
  notifyButton.classList.toggle("is-on", on);
  notifyButton.classList.toggle("is-denied", denied);
  const label = denied ? "알림 차단됨" : on ? "알림 켜짐" : "알림 받기";
  notifyButton.setAttribute("aria-label", label);
  notifyButton.title = label;
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

// ===== Web Push 구독 (백엔드 X0) — VAPID 공개키 / 백엔드 URL 미설정 시 inert 셸(게이트) =====
const VAPID_PUBLIC_KEY = ""; // 배포 시 실제 VAPID 공개키로 교체 (worker/wrangler.toml VAPID_PUBLIC 와 동일)
const PUSH_API_BASE = ""; // 배포된 Worker origin (예: https://kbo-tido.<sub>.workers.dev). 미설정 시 구독 안 함.
function pushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && PUSH_API_BASE);
}
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
function selectedPushTopics() {
  const code = TEAM_PUSH_CODE[selectedTeam] ?? selectedTeam;
  return Object.entries(readPushTopics())
    .filter(([, on]) => on === true)
    .map(([key]) => `${code}:${key}`);
}
async function subscribeToPush() {
  // 게이트: VAPID 키 + 백엔드 URL 이 설정돼야 실제 구독. 미설정 시 no-op(코드만 준비).
  if (!pushConfigured() || !("serviceWorker" in navigator) || Notification.permission !== "granted") {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
    const json = sub.toJSON();
    await fetch(`${PUSH_API_BASE}/api/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        topics: selectedPushTopics(),
      }),
    });
  } catch {
    // 구독 실패는 조용히 무시(다음 시도에 재시도).
  }
}

async function unsubscribeFromPush() {
  if (!pushConfigured() || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch(`${PUSH_API_BASE}/api/subscriptions`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // 실패는 조용히 무시(다음 시도에 재시도).
  }
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
    subscribeToPush(); // 백엔드 URL/VAPID 설정 시에만 실제 구독(게이트)
    await showGameNotification();
    trackNotificationPermission(permission, "game");
    return;
  }

  updateNotifyButton();
  trackNotificationPermission(permission, "game");
}

async function toggleNotifications() {
  const on = Notification.permission === "granted"
    && localStorage.getItem("eaglesNotifications") === "on";
  if (on) {
    localStorage.setItem("eaglesNotifications", "off");
    updateNotifyButton();
    await unsubscribeFromPush();
    return;
  }
  await enableNotifications();
}
notifyButton?.addEventListener("click", toggleNotifications);

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
  renderTicketOpenCard();
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

function handleShareGame(gameKey) {
  const game = [...(data.games ?? []), ...(data.ticketCalendar ?? [])].find((item) => gameId(item) === gameKey);

  if (!game) {
    return;
  }

  const ticketing = getTicketing(game);
  const openInfo = getTicketOpenInfo(game, ticketing);
  const shareData = {
    title: "KBO TIDO",
    text: `${game.away} vs ${game.home} 예매 오픈 ${openInfo.openText}`,
    url: location.href,
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
    return;
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(shareData.url)
      .then(() => showToast("링크를 복사했어요"))
      .catch(() => showToast("링크를 복사했어요"));
    return;
  }

  showToast("링크를 복사했어요");
}

document.addEventListener("click", (event) => {
  const retryButton = event.target.closest("[data-retry-data-load]");
  if (retryButton) {
    window.location.reload();
    return;
  }

  const shareButton = event.target.closest("[data-share-game]");
  if (shareButton) {
    handleShareGame(shareButton.dataset.shareGame);
    return;
  }

  const icsButton = event.target.closest("[data-add-ics]");
  if (icsButton) {
    const game = [...(data.games ?? []), ...(data.ticketCalendar ?? [])].find(
      (item) => gameId(item) === icsButton.dataset.addIcs,
    );
    if (game) {
      const ticketing = getTicketing(game);
      downloadOpenIcs(game, ticketing, getTicketOpenInfo(game, ticketing));
    }
    return;
  }

  const calendarMore = event.target.closest("[data-calendar-open-toggle]");
  if (calendarMore) {
    calendarOpenExpanded = !calendarOpenExpanded;
    renderTicketCalendar();
    return;
  }

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
  if (document.hidden) {
    // 숨김 동안 1초 인터벌 정지(배터리/연산 절약).
    stopTicketOpenCountdown();
    return;
  }
  pollData();
  // 복귀 시 카드 재렌더로 상태/카운트다운을 현재 시각 기준으로 재개.
  renderTicketOpenCard();
});

updateNotifyButton();
if (localStorage.getItem("eaglesNotifications") === "on") {
  subscribeToPush(); // 시작 시 서버 구독/topics 재동기화(endpoint 회전 복구 포함)
}
updateInstallAffordance();
applyTeamAccent();
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
