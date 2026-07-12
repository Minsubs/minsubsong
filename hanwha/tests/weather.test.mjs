import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

function declaration(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} declaration must exist`);
  const declarationStart = script.slice(start - 6, start) === "async " ? start - 6 : start;

  const bodyStart = script.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(declarationStart, index + 1);
  }

  throw new Error(`Could not parse ${name}`);
}

function constantObject(name) {
  const start = script.indexOf(`const ${name} = {`);
  assert.notEqual(start, -1, `${name} declaration must exist`);

  const bodyStart = script.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 2);
  }

  throw new Error(`Could not parse ${name}`);
}

test("characterization: every supported stadium location resolves to its current display name", () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${constantObject("STADIUM_NAME")}
    ${declaration("stadiumName")}
    globalThis.result = { names: STADIUM_NAME, fallback: stadiumName("퓨처스") };
  `, context);

  assert.deepEqual(Object.keys(context.result.names), [
    "잠실", "고척", "문학", "수원", "대전", "대구",
    "광주", "사직", "창원", "울산", "포항", "청주",
  ]);
  assert.equal(context.result.names.대전, "대전 한화생명볼파크");
  assert.equal(context.result.fallback, "퓨처스");
});

test("non-weather requests retain the generic cacheFirst fallback after the exact weather exception", () => {
  assert.match(
    serviceWorker,
    /url\.origin === WEATHER_API_ORIGIN[\s\S]*url\.pathname === WEATHER_API_PATH[\s\S]*event\.respondWith\(fetch\(request\)\)[\s\S]*event\.respondWith\(cacheFirst\(request\)\)/,
  );
});

test("stadium weather contract uses the exact provider endpoint and an application-owned cache", () => {
  assert.match(script, /const WEATHER_API_URL = "https:\/\/api\.open-meteo\.com\/v1\/forecast"/);
  assert.match(script, /const WEATHER_CACHE_KEY = "kboTidoWeatherCacheV1"/);
  assert.match(script, /function refreshStadiumWeather\(/);
  assert.match(serviceWorker, /url\.origin === WEATHER_API_ORIGIN/);
  assert.match(serviceWorker, /url\.pathname === WEATHER_API_PATH/);
  assert.match(serviceWorker, /event\.respondWith\(fetch\(request\)\)/);
});

const validPayload = {
  current: {
    time: "2026-07-11T17:00",
    temperature_2m: 27.5,
    apparent_temperature: 29.1,
    precipitation: 0,
    weather_code: 1,
  },
  hourly: {
    time: ["2026-07-11T17:00", "2026-07-11T18:00", "2026-07-11T19:00"],
    temperature_2m: [27.5, 26.8, 25.9],
    weather_code: [1, 2, 61],
    precipitation_probability: [10, 30, 70],
  },
};

function pureWeatherHarness() {
  const context = vm.createContext({ URL });
  vm.runInContext(`
    ${constantObject("STADIUM_NAME")}
    ${constantObject("STADIUM_COORDINATES")}
    const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
    ${declaration("stadiumName")}
    ${declaration("weatherCodeLabel")}
    ${declaration("openMeteoKstTime")}
    ${declaration("validWeatherNumber")}
    ${declaration("parseWeatherPayload")}
    ${declaration("validNormalizedForecast")}
    ${declaration("nearestGameWeather")}
    ${declaration("weatherStateFromForecast")}
    ${declaration("weatherUrlForStadium")}
    globalThis.api = {
      coordinates: STADIUM_COORDINATES,
      parse: parseWeatherPayload,
      label: weatherCodeLabel,
      nearest: nearestGameWeather,
      state: weatherStateFromForecast,
      url: weatherUrlForStadium,
    };
  `, context);
  return context.api;
}

test("every display stadium has fixed coordinates and builds only the exact KST forecast request", () => {
  const weather = pureWeatherHarness();
  assert.deepEqual(Object.keys(weather.coordinates), [
    "잠실", "고척", "문학", "수원", "대전", "대구",
    "광주", "사직", "창원", "울산", "포항", "청주",
  ]);
  for (const coordinates of Object.values(weather.coordinates)) {
    assert.equal(Number.isFinite(coordinates.latitude), true);
    assert.equal(Number.isFinite(coordinates.longitude), true);
  }
  const url = new URL(weather.url("대전"));
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.pathname, "/v1/forecast");
  assert.equal(url.searchParams.get("timezone"), "Asia/Seoul");
  assert.equal(url.searchParams.get("current"), "temperature_2m,apparent_temperature,precipitation,weather_code");
  assert.equal(url.searchParams.get("hourly"), "temperature_2m,weather_code,precipitation_probability");
  assert.equal(weather.url("퓨처스"), null);
});

test("valid provider data normalizes labels and selects the nearest KST hourly slot", () => {
  const weather = pureWeatherHarness();
  const forecast = weather.parse(validPayload);
  const gameAt = Date.parse("2026-07-11T18:30:00+09:00");
  const nearest = weather.nearest(forecast, gameAt);

  assert.deepEqual(JSON.parse(JSON.stringify(forecast.current)), {
    time: "2026-07-11T17:00",
    temperature: 27.5,
    apparentTemperature: 29.1,
    precipitation: 0,
    code: 1,
    condition: "대체로 맑음",
  });
  assert.equal(nearest.time, "2026-07-11T18:00");
  assert.equal(nearest.precipitationProbability, 30);
  assert.deepEqual(
    [0, 3, 45, 51, 61, 71, 80, 95, 99, -1].map(weather.label),
    ["맑음", "흐림", "안개", "이슬비", "비", "눈", "소나기", "뇌우", "우박 동반 뇌우", "알 수 없음"],
  );
});

test("malformed, missing, and misaligned provider data is rejected at the boundary", () => {
  const weather = pureWeatherHarness();
  const cases = [
    null,
    {},
    { ...validPayload, current: { ...validPayload.current, temperature_2m: "27" } },
    { ...validPayload, hourly: { ...validPayload.hourly, time: ["bad"] } },
    { ...validPayload, hourly: { ...validPayload.hourly, weather_code: [1] } },
    { ...validPayload, hourly: { ...validPayload.hourly, precipitation_probability: undefined } },
  ];
  for (const payload of cases) {
    assert.throws(() => weather.parse(payload), { name: "TypeError" });
  }
});

test("game times outside the provider window keep current conditions and report preparation", () => {
  const weather = pureWeatherHarness();
  const forecast = weather.parse(validPayload);
  const state = weather.state("대전", forecast, {
    fetchedAt: 1_000,
    gameAt: Date.parse("2026-07-12T18:00:00+09:00"),
    freshness: "fresh",
  });

  assert.equal(state.status, "out-of-range");
  assert.equal(state.forecastStatus, "out-of-range");
  assert.equal(state.current.temperature, 27.5);
  assert.equal(state.game, null);
  assert.equal(state.message, "경기 예보 준비 중");
});

function cacheHarness(initialValue, { readFails = false, writeFails = false } = {}) {
  let stored = initialValue;
  const localStorage = {
    getItem(key) {
      assert.equal(key, "kboTidoWeatherCacheV1");
      if (readFails) throw new Error("read failed");
      return stored;
    },
    setItem(key, value) {
      assert.equal(key, "kboTidoWeatherCacheV1");
      if (writeFails) throw new Error("write failed");
      stored = value;
    },
  };
  const context = vm.createContext({ localStorage });
  vm.runInContext(`
    ${constantObject("STADIUM_COORDINATES")}
    const WEATHER_CACHE_KEY = "kboTidoWeatherCacheV1";
    const WEATHER_FRESH_MS = 10 * 60 * 1000;
    const WEATHER_STALE_MS = 6 * 60 * 60 * 1000;
    ${declaration("openMeteoKstTime")}
    ${declaration("validWeatherNumber")}
    ${declaration("validNormalizedForecast")}
    ${declaration("writeWeatherCache")}
    ${declaration("readWeatherCache")}
    ${declaration("cachedWeather")}
    ${declaration("storeWeatherForecast")}
    globalThis.api = {
      read: readWeatherCache,
      cached: cachedWeather,
      store: storeWeatherForecast,
    };
  `, context);
  return { ...context.api, stored: () => stored };
}

test("weather cache honors fresh and stale TTLs, prunes expired data, and stores normalized values only", () => {
  const forecast = pureWeatherHarness().parse(validPayload);
  const now = 10_000_000;
  const initial = JSON.stringify({
    대전: { data: forecast, fetchedAt: now - 9 * 60 * 1000 },
    잠실: { data: forecast, fetchedAt: now - 11 * 60 * 1000 },
    고척: { data: forecast, fetchedAt: now - 6 * 60 * 60 * 1000 - 1 },
  });
  const cache = cacheHarness(initial);

  assert.equal(cache.cached("대전", now).freshness, "fresh");
  assert.equal(cache.cached("잠실", now).freshness, "stale");
  assert.equal(cache.cached("고척", now), null);
  assert.deepEqual(Object.keys(JSON.parse(cache.stored())), ["대전", "잠실"]);

  cache.store("대구", forecast, now);
  const serialized = cache.stored();
  assert.doesNotMatch(serialized, /latitude|longitude|temperature_2m|weather_code|precipitation_probability/);
  assert.equal(JSON.parse(serialized).대구.fetchedAt, now);
});

test("cache read and write failures degrade without throwing or exposing malformed entries", () => {
  const forecast = pureWeatherHarness().parse(validPayload);
  const readFailure = cacheHarness(null, { readFails: true });
  const writeFailure = cacheHarness(null, { writeFails: true });
  const malformed = cacheHarness('{"대전":{"raw":{"latitude":1},"fetchedAt":1}}');

  assert.deepEqual(JSON.parse(JSON.stringify(readFailure.read(10))), {});
  assert.doesNotThrow(() => writeFailure.store("대전", forecast, 10));
  assert.equal(malformed.cached("대전", 10), null);
});

async function loadWithFallback(cachedEntry, requestOutcome) {
  const context = vm.createContext({ cachedEntry, requestOutcome });
  vm.runInContext(`
    ${constantObject("STADIUM_NAME")}
    ${declaration("stadiumName")}
    ${declaration("openMeteoKstTime")}
    ${declaration("nearestGameWeather")}
    ${declaration("weatherStateFromForecast")}
    function cachedWeather() { return cachedEntry; }
    function requestStadiumForecast() {
      return requestOutcome instanceof Error ? Promise.reject(requestOutcome) : Promise.resolve(requestOutcome);
    }
    function storeWeatherForecast() {}
    ${declaration("loadStadiumWeather")}
    globalThis.promise = loadStadiumWeather("대전", Date.parse("2026-07-11T18:00:00+09:00"), 10_000);
  `, context);
  return context.promise;
}

test("provider failure labels usable six-hour data stale and expired or absent data unavailable", async () => {
  const forecast = pureWeatherHarness().parse(validPayload);
  const stale = await loadWithFallback(
    { data: forecast, fetchedAt: 1_000, freshness: "stale" },
    new Error("429"),
  );
  const unavailable = await loadWithFallback(null, new Error("500"));

  assert.equal(stale.status, "stale");
  assert.equal(stale.stadiumId, "대전");
  assert.equal(stale.game.precipitationProbability, 30);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.current, null);
});

function response({ status = 200, type = "basic", payload = validPayload, jsonError = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    type,
    json: async () => {
      if (jsonError) throw jsonError;
      return payload;
    },
  };
}

function requestHarness(fetchImpl, timeoutMs = 30) {
  const context = vm.createContext({
    AbortController,
    URL,
    fetch: fetchImpl,
    window: { setTimeout, clearTimeout },
  });
  vm.runInContext(`
    ${constantObject("STADIUM_COORDINATES")}
    const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
    const WEATHER_TIMEOUT_MS = ${timeoutMs};
    ${declaration("weatherCodeLabel")}
    ${declaration("openMeteoKstTime")}
    ${declaration("validWeatherNumber")}
    ${declaration("parseWeatherPayload")}
    ${declaration("weatherUrlForStadium")}
    const stadiumWeatherRequests = new Map();
    let activeWeatherStadium = null;
    ${declaration("requestStadiumForecast")}
    ${declaration("cancelStadiumWeatherRequest")}
    globalThis.api = {
      request: requestStadiumForecast,
      cancel: cancelStadiumWeatherRequest,
      inFlight: () => stadiumWeatherRequests.size,
    };
  `, context);
  return context.api;
}

test("same-stadium requests deduplicate and HTTP, opaque, CORS, JSON, and payload failures reject", async () => {
  let resolveFetch;
  let fetchCount = 0;
  const deferredFetch = new Promise((resolve) => { resolveFetch = resolve; });
  const deduped = requestHarness(() => {
    fetchCount += 1;
    return deferredFetch;
  });
  const first = deduped.request("대전");
  const second = deduped.request("대전");
  assert.equal(first, second);
  assert.equal(fetchCount, 1);
  resolveFetch(response());
  await Promise.all([first, second]);
  assert.equal(deduped.inFlight(), 0);

  const failures = [
    () => Promise.resolve(response({ status: 429 })),
    () => Promise.resolve(response({ status: 500 })),
    () => Promise.resolve(response({ type: "opaque" })),
    () => Promise.reject(new TypeError("CORS")),
    () => Promise.resolve(response({ jsonError: new SyntaxError("bad JSON") })),
    () => Promise.resolve(response({ payload: {} })),
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(requestHarness(fetchImpl).request("대전"));
  }
});

test("weather requests time out at the bounded signal and selection changes abort the old stadium", async () => {
  const timeout = requestHarness((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }), 5);
  await assert.rejects(timeout.request("대전"), { name: "AbortError" });
  assert.equal(timeout.inFlight(), 0);

  const abort = requestHarness((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }));
  const pending = abort.request("대전");
  abort.cancel("잠실");
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(abort.inFlight(), 0);
});

function refreshHarness(initialGame) {
  const deferred = new Map();
  const events = [];
  const context = vm.createContext({
    deferred,
    events,
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init.detail; }
    },
    window: { dispatchEvent: (event) => events.push(event) },
  });
  vm.runInContext(`
    ${constantObject("STADIUM_NAME")}
    ${constantObject("STADIUM_COORDINATES")}
    ${declaration("stadiumName")}
    let currentGame = ${JSON.stringify(initialGame)};
    let activeWeatherStadium = null;
    let weatherRequestGeneration = 0;
    let stadiumWeatherState = { status: "no-game" };
    function selectedLiveGame() { return currentGame; }
    function representativeGame() { return null; }
    function parseKstDate() { return new Date("2026-07-11T18:00:00+09:00"); }
    function cachedWeather() { return null; }
    function cancelStadiumWeatherRequest(next = null) { activeWeatherStadium = next; }
    function loadStadiumWeather(stadiumId) {
      return new Promise((resolve) => deferred.set(stadiumId, resolve));
    }
    ${declaration("publishStadiumWeatherState")}
    ${declaration("currentStadiumWeatherState")}
    ${declaration("refreshStadiumWeather")}
    globalThis.api = {
      refresh: refreshStadiumWeather,
      state: currentStadiumWeatherState,
      select: (game) => { currentGame = game; },
      resolve: (stadiumId, state) => deferred.get(stadiumId)(state),
    };
  `, context);
  return context.api;
}

test("rapid team changes ignore out-of-order completions while no-game and unknown stadium stay explicit", async () => {
  const refresh = refreshHarness({ location: "대전", date: "07.11", time: "18:00" });
  const daejeon = refresh.refresh();
  refresh.select({ location: "잠실", date: "07.11", time: "18:00" });
  const jamsil = refresh.refresh();
  refresh.resolve("잠실", { status: "fresh", stadiumId: "잠실" });
  await jamsil;
  refresh.resolve("대전", { status: "fresh", stadiumId: "대전" });
  await daejeon;
  assert.equal(refresh.state().stadiumId, "잠실");

  refresh.select(null);
  assert.equal((await refresh.refresh()).status, "no-game");
  refresh.select({ location: "퓨처스", date: "07.11", time: "18:00" });
  assert.equal((await refresh.refresh()).status, "unknown-stadium");
});

test("service worker sends only the exact weather origin and path directly to network", async () => {
  const handlers = {};
  let fetchCount = 0;
  let cacheOpenCount = 0;
  const context = vm.createContext({
    URL,
    Uint8Array,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    fetch: async (request) => {
      fetchCount += 1;
      return { marker: request.url };
    },
    caches: {
      open: async () => {
        cacheOpenCount += 1;
        return { match: async () => null, put: async () => {} };
      },
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      addEventListener: (type, handler) => { handlers[type] = handler; },
      registration: { showNotification: async () => {}, scope: "https://example.test/app/" },
      clients: { claim: () => {}, matchAll: async () => [], openWindow: async () => {} },
      skipWaiting: () => {},
      location: { origin: "https://example.test" },
    },
  });
  vm.runInContext(serviceWorker, context);
  let responsePromise;
  handlers.fetch({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://api.open-meteo.com/v1/forecast?latitude=36.3171",
    },
    respondWith: (promise) => { responsePromise = promise; },
  });
  const result = await responsePromise;

  assert.equal(result.marker, "https://api.open-meteo.com/v1/forecast?latitude=36.3171");
  assert.equal(fetchCount, 1);
  assert.equal(cacheOpenCount, 0);
  assert.doesNotMatch(serviceWorker, /cacheFirst\(request\)[\s\S]*WEATHER_API/);
});

test("weather is isolated from user location, raw payload exposure, app loading, and app-wide errors", () => {
  const loadData = declaration("loadData");
  const renderAll = declaration("renderAll");
  const refreshViews = declaration("refreshSelectedTeamViews");
  const renderDataError = declaration("renderDataError");

  assert.doesNotMatch(script, /navigator\.geolocation|\bgeolocation\b/);
  assert.doesNotMatch(loadData, /weather|StadiumWeather/);
  assert.doesNotMatch(renderDataError, /weather|StadiumWeather/);
  assert.equal([...renderAll.matchAll(/\brefreshStadiumWeather\(/g)].length, 1);
  assert.equal([...refreshViews.matchAll(/\brefreshStadiumWeather\(/g)].length, 1);
  assert.match(script, /new CustomEvent\("kbo-tido-weather-state"/);
  assert.doesNotMatch(script, /localStorage\.setItem\([^\n]*(latitude|longitude|temperature_2m|weather_code)/);
});
