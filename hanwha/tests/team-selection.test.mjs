import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

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

function selectionHarness(initialValue, { throwOnRead = false } = {}) {
  let stored = initialValue;
  const localStorage = {
    getItem(key) {
      assert.equal(key, "selectedTeam");
      if (throwOnRead) throw new Error("storage unavailable");
      return stored;
    },
    setItem(key, value) {
      assert.equal(key, "selectedTeam");
      stored = value;
    },
  };
  const context = vm.createContext({ localStorage });
  vm.runInContext(`
    const SELECTED_TEAM_KEY = "selectedTeam";
    const ALL_TEAMS = "all";
    const teamColors = { 한화: {}, LG: {}, SSG: {}, 두산: {}, KIA: {}, 삼성: {}, 롯데: {}, KT: {}, NC: {}, 키움: {} };
    ${declaration("isValidTeamSelection")}
    ${declaration("readSelectedTeam")}
    let selectedTeam = readSelectedTeam();
    let accentCalls = 0;
    function applyTeamAccent() { accentCalls += 1; }
    ${declaration("isNeutralTeamSelection")}
    ${declaration("isSelectedTeam")}
    ${declaration("setSelectedTeam")}
    globalThis.selectionApi = {
      read: readSelectedTeam,
      set: setSelectedTeam,
      selected: () => selectedTeam,
      highlight: isSelectedTeam,
      accentCalls: () => accentCalls,
    };
  `, context);

  return {
    ...context.selectionApi,
    stored: () => stored,
  };
}

test("characterization: a valid stored club remains selected and persists unchanged", () => {
  const selection = selectionHarness("LG");

  assert.equal(selection.read(), "LG");
  assert.equal(selection.selected(), "LG");

  selection.set("LG");
  assert.equal(selection.selected(), "LG");
  assert.equal(selection.stored(), "LG");
});

test("no, invalid, or unreadable storage resolves to the neutral league scope", () => {
  assert.equal(selectionHarness(null).read(), "all");
  assert.equal(selectionHarness("bogus").read(), "all");
  assert.equal(selectionHarness(null, { throwOnRead: true }).read(), "all");
});

test("neutral is accepted and persisted explicitly while invalid writes are ignored", () => {
  const selection = selectionHarness("LG");

  selection.set("all");
  assert.equal(selection.selected(), "all");
  assert.equal(selection.stored(), "all");

  selection.set("bogus");
  assert.equal(selection.selected(), "all");
  assert.equal(selection.stored(), "all");
});

const inheritedTeamKeys = ["__proto__", "constructor", "toString", "hasOwnProperty"];

test("stored Object.prototype keys resolve to neutral without becoming selected or highlighted", () => {
  for (const inheritedKey of inheritedTeamKeys) {
    const selection = selectionHarness(inheritedKey);
    assert.equal(selection.read(), "all", inheritedKey);
    assert.equal(selection.selected(), "all", inheritedKey);
    assert.equal(selection.highlight(inheritedKey), false, inheritedKey);
    assert.equal(selection.accentCalls(), 0, inheritedKey);
  }
});

test("setter rejects Object.prototype keys without persisting, highlighting, or applying accent", () => {
  for (const inheritedKey of inheritedTeamKeys) {
    const selection = selectionHarness("all");
    selection.set(inheritedKey);
    assert.equal(selection.selected(), "all", inheritedKey);
    assert.equal(selection.stored(), "all", inheritedKey);
    assert.equal(selection.highlight(inheritedKey), false, inheritedKey);
    assert.equal(selection.accentCalls(), 0, inheritedKey);
  }
});

function gameDomainHarness(team) {
  const context = vm.createContext({});
  vm.runInContext(`
    const ALL_TEAMS = "all";
    let selectedTeam = ${JSON.stringify(team)};
    let data = {
      games: [
        { id: "lg", home: "LG", away: "두산", type: "upcoming" },
        { id: "hh", home: "한화", away: "KIA", type: "upcoming" },
      ],
      ticketCalendar: [
        { id: "ssg", home: "SSG", away: "NC", type: "upcoming" },
      ],
      liveGame: [
        { id: "scheduled", homeTeam: "LG", awayTeam: "두산", status: "scheduled" },
        { id: "live", homeTeam: "한화", awayTeam: "KIA", status: "live" },
      ],
    };
    ${declaration("isNeutralTeamSelection")}
    ${declaration("selectionIncludesTeams")}
    ${declaration("isSelectedTeam")}
    ${declaration("selectedTeamGames")}
    ${declaration("normalizedLiveGames")}
    ${declaration("selectedLiveGame")}
    globalThis.gameApi = {
      games: () => selectedTeamGames().map((game) => game.id),
      live: () => selectedLiveGame()?.id ?? null,
      highlight: isSelectedTeam,
    };
  `, context);
  return context.gameApi;
}

test("neutral sees league-wide game candidates and the first live game without highlights", () => {
  const neutral = gameDomainHarness("all");

  assert.deepEqual([...neutral.games()], ["lg", "hh", "ssg"]);
  assert.equal(neutral.live(), "live");
  assert.equal(neutral.highlight("한화"), false);
  assert.equal(neutral.highlight("LG"), false);
});

test("valid club game, live, and highlight behavior remains scoped to that club", () => {
  const lg = gameDomainHarness("LG");

  assert.deepEqual([...lg.games()], ["lg"]);
  assert.equal(lg.live(), "scheduled");
  assert.equal(lg.highlight("LG"), true);
  assert.equal(lg.highlight("한화"), false);
});

function ticketPickHarness(team) {
  const context = vm.createContext({ Date });
  vm.runInContext(`
    const ALL_TEAMS = "all";
    let selectedTeam = ${JSON.stringify(team)};
    const future = Date.now() + 60_000;
    const games = [
      { id: "lg-later", home: "LG", away: "두산", type: "upcoming", openAt: new Date(future + 60_000) },
      { id: "hh-nearest", home: "한화", away: "KIA", type: "upcoming", openAt: new Date(future) },
    ];
    ${declaration("isNeutralTeamSelection")}
    ${declaration("selectionIncludesTeams")}
    function selectedTeamGames() {
      return games.filter((game) => selectionIncludesTeams(game.home, game.away));
    }
    function getTicketing() { return {}; }
    function getTicketOpenInfo(game) {
      return { openAt: game.openAt, isOpen: false };
    }
    ${declaration("pickNextTicketOpenGame")}
    globalThis.pickId = () => pickNextTicketOpenGame()?.game.id ?? null;
  `, context);
  return context.pickId();
}

test("neutral picks the nearest league-wide ticket opening while valid clubs remain scoped", () => {
  assert.equal(ticketPickHarness("all"), "hh-nearest");
  assert.equal(ticketPickHarness("LG"), "lg-later");
});

function neutralContractHarness(team) {
  const removedProperties = [];
  const context = vm.createContext({ removedProperties });
  vm.runInContext(`
    const ALL_TEAMS = "all";
    let selectedTeam = ${JSON.stringify(team)};
    const teamColors = { LG: { base: "#000000", ink: "#ffffff" } };
    const data = {
      summary: [{ label: "legacy-hanwha" }],
      teamStandings: [{ team: "LG", rank: 1, wins: 1, losses: 0, draws: 0, pct: "1.000", streak: "W1" }],
    };
    const document = {
      documentElement: {
        classList: { contains: () => false },
        style: {
          removeProperty: (property) => removedProperties.push(property),
          setProperty() {},
        },
      },
    };
    function readableAccent() { return "#000000"; }
    function selectedLiveGame() { return null; }
    function scoreValue() { return "-"; }
    let pushTopicReads = 0;
    function readPushTopics() {
      pushTopicReads += 1;
      return { ticket_open: true };
    }
    const TEAM_PUSH_CODE = { LG: "LG" };
    ${declaration("isNeutralTeamSelection")}
    ${declaration("selectedTeamDemandDetails")}
    ${declaration("summaryCardsForSelectedTeam")}
    ${declaration("applyTeamAccent")}
    ${declaration("buildGameNotification")}
    ${declaration("selectedPushTopics")}
    applyTeamAccent();
    globalThis.contractApi = {
      demand: () => selectedTeamDemandDetails(),
      summary: () => summaryCardsForSelectedTeam(),
      notification: () => buildGameNotification(),
      topics: () => selectedPushTopics(),
      topicReads: () => pushTopicReads,
      removed: () => removedProperties,
    };
  `, context);
  return context.contractApi;
}

test("neutral omits legacy summary, resets root tokens, emits league demand, and has no push topics", () => {
  const neutral = neutralContractHarness("all");

  assert.deepEqual(JSON.parse(JSON.stringify(neutral.summary())), []);
  assert.deepEqual(JSON.parse(JSON.stringify(neutral.demand())), { scope: "league" });
  assert.deepEqual([...neutral.topics()], []);
  assert.equal(neutral.topicReads(), 0, "neutral topics must return before reading stored toggles");
  assert.deepEqual([...neutral.removed()], [
    "--accent", "--accent-strong", "--accent-2", "--stamp", "--ring",
    "--accent-diag", "--team-ink", "--grad-accent",
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(neutral.notification())), {
    title: "KBO 경기 알림",
    body: "KBO 경기 소식",
  });
});

test("valid club summary, notification, demand, and push topics remain team-specific", () => {
  const lg = neutralContractHarness("LG");

  assert.equal(lg.summary()[0].value, "1위");
  assert.deepEqual(JSON.parse(JSON.stringify(lg.demand())), { team: "LG" });
  assert.deepEqual([...lg.topics()], ["LG:ticket_open"]);
  assert.equal(lg.topicReads(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(lg.notification())), {
    title: "LG 경기 알림",
    body: "LG 경기",
  });
});

test("every current selected-team consumer and stadium weather refresh exactly once", () => {
  const refresh = declaration("refreshSelectedTeamViews");
  const consumers = [
    "renderSummary",
    "renderRankingPanels",
    "renderTicketCalendar",
    "renderLiveGame",
    "renderLiveScoreboard",
    "renderGames",
    "renderTickets",
    "renderTicketOpenCard",
    "renderNotifyCenter",
    "refreshStadiumWeather",
  ];

  for (const consumer of consumers) {
    assert.equal([...refresh.matchAll(new RegExp(`\\b${consumer}\\(`, "g"))].length, 1, consumer);
  }
});

test("neutral rendering contracts avoid legacy Hanwha fallback and raw all copy", () => {
  const renderSummary = declaration("renderSummary");
  const neutralGuard = renderSummary.indexOf("isNeutralTeamSelection()");
  const legacyFallback = renderSummary.indexOf("data.summary");

  assert.ok(neutralGuard >= 0 && neutralGuard < legacyFallback, "neutral summary must exit before legacy data.summary fallback");
  assert.match(declaration("teamPickerDisplayLabel"), /team === ALL_TEAMS \? "KBO 전체" : team/);
  assert.match(script, /venueType: isNeutralTeamSelection\(\) \? "홈팀 기준"/);
  assert.doesNotMatch(script, /\$\{selectedTeam\} 의/);
  assert.doesNotMatch(script, /all 의|all 경기/);
  assert.match(script, /const mine = isSelectedTeam\(game\.home\) \|\| isSelectedTeam\(game\.away\)/);
  assert.match(script, /const mine = isSelectedTeam\(game\.homeTeam\) \|\| isSelectedTeam\(game\.awayTeam\)/);
  assert.match(script, /const isMine = isSelectedTeam\(team\.team\)/);
});
