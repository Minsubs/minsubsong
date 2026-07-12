import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

function block(source, selector, nextSelector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `missing ${selector}`);
  const end = source.indexOf(nextSelector, start + selector.length);
  return source.slice(start, end === -1 ? undefined : end);
}

test("topbar owns an original two-tone brand lockup and a real weather disclosure button", () => {
  const topbar = block(html, '<header class="topbar">', '<div class="team-picker__popover"');

  assert.match(topbar, /class="brand-mark"[\s\S]*?<svg[\s\S]*?<path/);
  assert.match(topbar, /class="brand-wordmark"[\s\S]*?class="brand-wordmark__kbo">KBO<[\s\S]*?class="brand-wordmark__tido">TIDO</);
  assert.match(topbar, /<button[\s\S]*?id="weatherDisclosureButton"[\s\S]*?aria-expanded="false"[\s\S]*?aria-controls="weatherDisclosurePanel"/);
  assert.match(topbar, /id="weatherDisclosureSummary"/);
  assert.match(topbar, /id="weatherDisclosurePanel"[\s\S]*?hidden/);
});

test("weather disclosure visibly attributes Open-Meteo and explains direct-provider request metadata", () => {
  assert.match(html, /경기장 기준 · 내 위치 미사용 ·[\s\S]*?<a[^>]+href="https:\/\/open-meteo\.com\/"[^>]*>Open-Meteo<\/a>/);
  assert.match(html, /브라우저 위치 권한과 사용자 좌표를 사용하거나 저장하지 않습니다/);
  assert.match(html, /브라우저가 Open-Meteo에 직접 요청[\s\S]*?IP/);
});

test("weather UI consumes the state event and renders every required state without HTML injection", () => {
  assert.match(script, /function renderWeatherDisclosure\(state\)/);
  assert.match(script, /window\.addEventListener\("kbo-tido-weather-state",\s*\([^)]*\)\s*=>\s*{[\s\S]*?renderWeatherDisclosure/);
  for (const state of ["loading", "fresh", "stale", "unavailable", "no-game", "unknown-stadium", "out-of-range"]) {
    assert.match(script, new RegExp(`(?:case\\s+|status\\s*===\\s*)["']${state}["']`), `missing ${state} UI state`);
  }
  const renderer = block(script, "function renderWeatherDisclosure(state)", "function toggleWeatherDisclosure");
  assert.doesNotMatch(renderer, /innerHTML|insertAdjacentHTML/);
  assert.match(renderer, /textContent/);
  assert.match(script, /weatherDisclosureButton\.focus\(\)/);
});

test("collapsed weather geometry is reserved and mobile order is explicit", () => {
  assert.match(css, /\.weather-disclosure__trigger\s*{[\s\S]*?min-height:\s*44px;[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.weather-disclosure__summary\s*{[\s\S]*?min-width:[\s\S]*?max-width:/);
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.topbar__primary[\s\S]*?\.weather-disclosure/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.weather-disclosure/);
});
