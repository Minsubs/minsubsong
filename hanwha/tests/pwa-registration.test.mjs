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
