import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

function declaration(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} declaration must exist`);

  const bodyStart = script.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }

  throw new Error(`Could not parse ${name}`);
}

test("characterization: the shared selection contract changes to a valid team", () => {
  let stored = "all";
  const context = vm.createContext({
    localStorage: {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    },
  });
  vm.runInContext(`
    const SELECTED_TEAM_KEY = "selectedTeam";
    const ALL_TEAMS = "all";
    const teamColors = { LG: {} };
    ${declaration("isValidTeamSelection")}
    let selectedTeam = "all";
    function applyTeamAccent() {}
    ${declaration("setSelectedTeam")}
    setSelectedTeam("LG");
    globalThis.result = { selectedTeam, stored: localStorage.getItem(SELECTED_TEAM_KEY) };
  `, context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), { selectedTeam: "LG", stored: "LG" });
});

test("picker markup replaces the select with an anchored 11-option listbox contract", () => {
  assert.doesNotMatch(html, /<select[^>]+id="teamSelect"/);
  assert.match(
    html,
    /<button[^>]+id="teamPickerButton"[^>]+aria-haspopup="listbox"[^>]+aria-expanded="false"[^>]+aria-controls="teamPickerList"/,
  );
  assert.match(html, /id="teamPickerList"[^>]+role="listbox"[^>]+aria-label="내 구단 선택"/);
  assert.equal([...html.matchAll(/data-team-value="[^"]+"/g)].length, 11);
  assert.match(html, /data-team-value="all"[\s\S]*KBO 전체/);
  assert.equal([...html.matchAll(/role="option"/g)].length, 11);
});

test("picker synchronization exposes exactly one selected option beyond color", () => {
  const options = ["all", "한화", "LG"].map((team) => ({
    dataset: { teamValue: team },
    tabIndex: -1,
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  }));
  const context = vm.createContext({ options });
  vm.runInContext(`
    let selectedTeam = "LG";
    const ALL_TEAMS = "all";
    const teamInitials = { LG: "LG" };
    const teamPickerButton = { dataset: {}, setAttribute() {} };
    const teamPickerLabel = { textContent: "" };
    const teamPickerBadge = { textContent: "" };
    const teamPickerOptions = options;
    ${declaration("teamPickerDisplayLabel")}
    ${declaration("teamPickerBadgeLabel")}
    ${declaration("syncTeamPicker")}
    syncTeamPicker();
  `, context);

  assert.deepEqual(
    options.map((option) => option.attributes["aria-selected"]),
    ["false", "false", "true"],
  );
  assert.deepEqual(options.map((option) => option.tabIndex), [-1, -1, 0]);
});

test("picker source covers managed keyboard focus, non-modal closing, and focus return", () => {
  assert.match(script, /case "ArrowDown"/);
  assert.match(script, /case "ArrowUp"/);
  assert.match(script, /case "Home"/);
  assert.match(script, /case "End"/);
  assert.match(script, /case "Enter"/);
  assert.match(script, /case " "/);
  assert.match(script, /case "Escape"/);
  assert.match(script, /case "Tab"/);
  assert.match(script, /teamPickerButton\.focus\(\)/);
  assert.match(script, /document\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(html, /aria-modal="true"[^>]*teamPicker|teamPicker[^>]*aria-modal="true"/);
});

test("picker targets are at least 44px and reduced motion disables the discovery pulse", () => {
  assert.match(styles, /\.team-picker__trigger\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(styles, /\.team-picker__option\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.team-picker__trigger\.is-discovering::after[\s\S]*animation:\s*none/);
  assert.match(script, /hasValidStoredTeamSelection/);
  assert.match(script, /is-discovering/);
});

function discoveryHarness(selectedTeam, discovered, throwOnRead = false) {
  const context = vm.createContext({
    localStorage: {
      getItem(key) {
        if (throwOnRead) throw new Error("storage unavailable");
        return key === "selectedTeam" ? selectedTeam : discovered;
      },
    },
  });
  vm.runInContext(`
    const SELECTED_TEAM_KEY = "selectedTeam";
    const TEAM_PICKER_DISCOVERY_KEY = "teamPickerDiscovered";
    const ALL_TEAMS = "all";
    const teamColors = { LG: {} };
    ${declaration("isValidTeamSelection")}
    ${declaration("hasValidStoredTeamSelection")}
    ${declaration("hasDiscoveredTeamPicker")}
    globalThis.shouldPulse = !hasValidStoredTeamSelection() && !hasDiscoveredTeamPicker();
  `, context);
  return context.shouldPulse;
}

test("discovery pulse is first-use only and never shown for a valid stored selection", () => {
  assert.equal(discoveryHarness(null, null), true);
  assert.equal(discoveryHarness("bogus", null), true);
  assert.equal(discoveryHarness(null, "1"), false);
  assert.equal(discoveryHarness("all", null), false);
  assert.equal(discoveryHarness("LG", null), false);
  assert.equal(discoveryHarness(null, null, true), true);
});
