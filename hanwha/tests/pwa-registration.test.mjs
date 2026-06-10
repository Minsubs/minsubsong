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
  assert.match(serviceWorker, /eagles-lounge-v22/);
  assert.match(serviceWorker, /\.\/data\/ticketing-calendar\.json\?v=19/);
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

test("demand validation controls accessible under the 더보기 (more) tab", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

  // 수요 검증은 5탭 IA 에서 "더보기" 탭(more)으로 통합됨.
  assert.match(index, /data-view-target="more"[^>]*>더보기/);
  assert.match(index, /id="validation"[^>]*data-view-panel="more"/);
  assert.match(index, /id="demandSignalBoard"/);
  assert.match(index, /id="demandSignalEvents"/);
  assert.match(index, /id="exportDemandSignals"/);
  assert.match(index, /id="resetDemandSignals"/);
});

test("demand validation signals are stored locally and wired to ticket actions", async () => {
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

  assert.match(script, /DEMAND_SIGNALS_KEY\s*=\s*"eaglesDemandSignals"/);
  assert.match(script, /function trackDemandSignal/);
  assert.match(script, /function renderDemandSignals/);
  assert.match(script, /data-demand-action="provider-click"/);
  assert.match(script, /trackDemandSignal\("ticket_reminder_saved"/);
  assert.match(script, /trackDemandSignal\("calendar_filter_selected"/);
});
