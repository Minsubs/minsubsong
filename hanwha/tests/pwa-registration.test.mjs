import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("script registers service worker and best-effort periodic data refresh", async () => {
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

  assert.match(script, /navigator\.serviceWorker\s*\.\s*register\("\.\/service-worker\.js"\)/);
  assert.match(script, /registerPeriodicSync\(registration\)/);
  assert.match(script, /registration\.periodicSync\.register\("refresh-data",\s*\{\s*minInterval:\s*6 \* 60 \* 60 \* 1000/s);
});

test("service worker handles GitHub Pages subpath notification clicks and periodic sync", async () => {
  const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(serviceWorker, /self\.addEventListener\("periodicsync"/);
  assert.match(serviceWorker, /event\.tag === "refresh-data"/);
});

test("app shell and data loader include ticketing calendar", async () => {
  const [script, serviceWorker] = await Promise.all([
    readFile(new URL("../script.js", import.meta.url), "utf8"),
    readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
  ]);

  assert.match(script, /ticketCalendar:\s*\[\]/);
  assert.match(script, /ticketCalendar:\s*"\.\/data\/ticketing-calendar\.json"/);
  assert.match(script, /fetchJson\(dataFiles\.ticketCalendar\)/);
  assert.match(serviceWorker, /eagles-lounge-v36/);
  assert.match(serviceWorker, /\.\/data\/ticketing-calendar\.json\?v=19/);
});

test("index.html and service worker reference the same css/js asset versions", async () => {
  const [index, serviceWorker] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
  ]);

  // CSS/JS 변경 시 ?v 와 SW precache 가 함께 bump 되지 않으면 서비스워커가
  // cacheFirst 로 옛 에셋을 계속 서빙한다(스타일/스크립트 깨짐). 버전 드리프트 회귀 가드.
  const styleV = index.match(/styles\.css\?v=(\d+)/)?.[1];
  const scriptV = index.match(/script\.js\?v=(\d+)/)?.[1];
  assert.ok(styleV && scriptV, "index.html 은 styles.css/script.js 에 ?v 버전을 달아야 함");
  assert.match(serviceWorker, new RegExp(`styles\\.css\\?v=${styleV}\\b`), "SW precache styles.css 버전이 index.html 과 일치해야 함");
  assert.match(serviceWorker, new RegExp(`script\\.js\\?v=${scriptV}\\b`), "SW precache script.js 버전이 index.html 과 일치해야 함");
});

test("calendar controls accessible under the 예매 (tickets) tab", async () => {
  const [index, script] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../script.js", import.meta.url), "utf8"),
  ]);

  // 캘린더는 5탭 IA 에서 "예매" 탭(tickets)으로 통합됨.
  assert.match(index, /data-view-target="tickets"[^>]*>예매/);
  assert.match(index, /id="calendar"[^>]*data-view-panel="tickets"/);
  assert.match(index, /id="ticketCalendarFilters"/);
  assert.match(index, /id="ticketCalendarList"/);
  assert.match(script, /function renderTicketCalendar/);
  assert.match(script, /\.\.\.data\.games,\s*\.\.\.\(data\.ticketCalendar \?\? \[\]\)/);
});

test("demand validation UI is removed from public screens while signal collection remains", async () => {
  const [index, script] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../script.js", import.meta.url), "utf8"),
  ]);

  // 수요 검증 신호는 운영자용이라 공개 UI 에서 제거됨.
  assert.doesNotMatch(index, /id="validation"/);
  assert.doesNotMatch(index, /id="demandSignalBoard"/);

  // 신호 수집(trackDemandSignal)과 localStorage 저장은 향후 백엔드 익명 집계용으로 유지.
  assert.match(script, /function trackDemandSignal/);
  assert.match(script, /DEMAND_SIGNALS_KEY/);
  assert.doesNotMatch(script, /function renderDemandSignals/);
  assert.doesNotMatch(script, /function exportDemandSignalSnapshot/);
  assert.doesNotMatch(script, /function resetDemandSignalSnapshot/);
});

test("cancel ticket concierge stays within compliant scope", async () => {
  const [index, script] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../script.js", import.meta.url), "utf8"),
  ]);

  // 취소표 컨시어지 섹션은 예매(tickets) 탭 안에 있어야 한다.
  assert.match(index, /id="cancel-watch"[^>]*data-view-panel="tickets"/);
  assert.match(index, /id="cancelWatchList"/);
  // 소개문에 "자동 감시 아님" 고지가 있어야 한다.
  assert.match(index, /class="meta cancel-watch-intro"[\s\S]*?실시간으로 감시하지 않/);

  // 로컬 저장 키 / 수요 신호 / 예매처별 대기 서비스 메타.
  assert.match(script, /"cancelWatchGames"/);
  assert.match(script, /cancel_watch_saved/);
  assert.match(script, /cancelWaiting/);

  // 컴플라이언스 가드: script.js 의 모든 fetch( 호출은 fetchJson 의 `${path} 템플릿,
  // 고정 경기장용 Open-Meteo URL, 또는 앱 자체 백엔드(`${PUSH_API_BASE} — Web Push 구독 등록)만 허용.
  // (예매처 도메인 자동 조회/폴링·스크래핑 금지 — CANCEL_TICKET_ALERT_RESEARCH.md 6절)
  const fetchCalls = [...script.matchAll(/\bfetch\(\s*([^)\n]*)/g)];
  assert.ok(fetchCalls.length > 0, "fetch( 사용처가 최소 1곳(fetchJson) 있어야 함");
  for (const [whole, arg] of fetchCalls) {
    assert.match(
      arg,
      /^(weatherUrl|`\$\{path\}|`\$\{PUSH_API_BASE\}|"\.\/data)/,
      `허용되지 않은 fetch 사용처: ${whole}`,
    );
  }
  // 예매처 도메인이 fetch 대상이 되지 않도록 이중 가드.
  assert.doesNotMatch(script, /fetch\([^)]*(ticketlink|interpark|nolticket|giantsclub|ncdinos|ssglanders)/i);
});

test("demand validation signals are stored locally and wired to ticket actions", async () => {
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

  assert.match(script, /DEMAND_SIGNALS_KEY\s*=\s*"eaglesDemandSignals"/);
  assert.match(script, /function trackDemandSignal/);
  assert.match(script, /data-demand-action="provider-click"/);
  assert.match(script, /trackDemandSignal\("ticket_reminder_saved"/);
  assert.match(script, /trackDemandSignal\("calendar_filter_selected"/);
});

test("buildOpenIcs produces a compliant VEVENT with a -PT10M alarm and no external fetch", async () => {
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

  // 순수함수 + 클라 Blob 다운로드(외부 fetch 무접촉).
  assert.match(script, /function buildOpenIcs\(game, ticketing, openInfo\)/);
  assert.match(script, /new Blob\(\[ics\], \{ type: "text\/calendar/);
  assert.match(script, /kbo-tido-open-/);
  // VEVENT 필수 필드: DTSTART/DURATION PT10M/SUMMARY 마커/VALARM -PT10M.
  assert.match(script, /`DTSTART:\$\{start\}`/);
  assert.match(script, /"DURATION:PT10M"/);
  assert.match(script, /\[예매오픈\] \$\{game\.away\} vs \$\{game\.home\} \(\$\{provider\}\)/);
  assert.match(script, /"TRIGGER:-PT10M"/);
  // '캘린더에 추가' 액션이 히어로/스텁에 노출된다.
  assert.match(script, /data-add-ics="\$\{gameId\(game\)\}"/);
});

test("booking provider URLs have one source in the data pipeline", async () => {
  const [script, updateData, providerConfig, ticketCalendar] = await Promise.all([
    readFile(new URL("../script.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/update-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/ticket-provider-config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../data/ticketing-calendar.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(script, /https:\/\/tickets\.interpark\.com\/contents\/sports/);
  assert.doesNotMatch(ticketCalendar, /https:\/\/tickets\.interpark\.com\/contents\/sports/);
  assert.doesNotMatch(script, /const ticketProviders\s*=/);
  assert.match(updateData, /import \{ TICKET_PROVIDERS \} from "\.\/ticket-provider-config\.mjs"/);
  assert.doesNotMatch(updateData, /url: "https:\/\/ticket\.interpark\.com\/Contents\/Sports"/);
  // 2026-07-24 NOL(야놀자) 통합 — 구 인터파크 예매 URL은 설정에서 완전 소멸(두산·키움 모두 이관).
  assert.equal(
    [...providerConfig.matchAll(/url: "https:\/\/ticket\.interpark\.com\/Contents\/Sports"/g)].length,
    0,
  );
  assert.match(providerConfig, /url: "https:\/\/nol\.yanolja\.com\/ticket\/genre\/sports\/bears"/);
  assert.match(providerConfig, /url: "https:\/\/nol\.yanolja\.com\/ticket\/genre\/sports\/heroes"/);
  assert.doesNotMatch(script, /https:\/\/(?:www\.)?ticketlink\.co\.kr\/sports/);
  assert.match(script, /const cancelWaitingByTeam\s*=/);
  assert.match(ticketCalendar, /"url": "https:\/\/nol\.yanolja\.com\/ticket\/genre\/sports\/(bears|heroes)"/);
  assert.doesNotMatch(ticketCalendar, /"url": "https:\/\/ticket\.interpark\.com\/Contents\/Sports"/);
});
