// worker/test/cors.test.mjs
// node --test unit tests for cors.js (pure functions) and db.js (pure helpers).
// No live D1 / no network. Run: node --test worker/test/cors.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseAllowedOrigins,
  isOriginAllowed,
  corsHeaders,
  handlePreflight,
  withCors,
} from "../lib/cors.js";

import {
  serializeTopics,
  parseTopics,
  topicLikePattern,
  upsertParams,
  rowToSubscription,
  SQL,
} from "../lib/db.js";

const PAGES = "https://minsub.github.io";

// ---------------------------------------------------------------------------
// cors.js
// ---------------------------------------------------------------------------

test("parseAllowedOrigins: single origin", () => {
  const set = parseAllowedOrigins(PAGES);
  assert.equal(set.size, 1);
  assert.ok(set.has(PAGES));
});

test("parseAllowedOrigins: comma list, trimmed and normalized", () => {
  const set = parseAllowedOrigins(` ${PAGES} , https://tido.example.com `);
  assert.equal(set.size, 2);
  assert.ok(set.has(PAGES));
  assert.ok(set.has("https://tido.example.com"));
});

test("parseAllowedOrigins: wildcard is rejected", () => {
  assert.equal(parseAllowedOrigins("*").size, 0);
  const set = parseAllowedOrigins(`*, ${PAGES}`);
  assert.equal(set.size, 1);
  assert.ok(!set.has("*"));
});

test("parseAllowedOrigins: junk / empty -> empty set", () => {
  assert.equal(parseAllowedOrigins(undefined).size, 0);
  assert.equal(parseAllowedOrigins("").size, 0);
  assert.equal(parseAllowedOrigins("not a url").size, 0);
  assert.equal(parseAllowedOrigins(null).size, 0);
});

test("parseAllowedOrigins: strips trailing path/slash to bare origin", () => {
  const set = parseAllowedOrigins("https://minsub.github.io/kbo-tido/");
  assert.ok(set.has(PAGES));
});

test("isOriginAllowed: exact match only", () => {
  const allowed = parseAllowedOrigins(PAGES);
  assert.equal(isOriginAllowed(PAGES, allowed), true);
  assert.equal(isOriginAllowed("https://evil.example.com", allowed), false);
  assert.equal(isOriginAllowed("http://minsub.github.io", allowed), false); // scheme differs
  assert.equal(isOriginAllowed(null, allowed), false);
  assert.equal(isOriginAllowed("", allowed), false);
});

test("isOriginAllowed: empty allowlist denies everything", () => {
  assert.equal(isOriginAllowed(PAGES, new Set()), false);
});

test("corsHeaders: allowed origin gets ACAO; never wildcard", () => {
  const allowed = parseAllowedOrigins(PAGES);
  const h = corsHeaders(PAGES, allowed);
  assert.equal(h["Access-Control-Allow-Origin"], PAGES);
  assert.notEqual(h["Access-Control-Allow-Origin"], "*");
  assert.equal(h["Vary"], "Origin");
  assert.ok(h["Access-Control-Allow-Methods"].includes("POST"));
  assert.ok(h["Access-Control-Allow-Methods"].includes("DELETE"));
});

test("corsHeaders: disallowed origin omits ACAO entirely", () => {
  const allowed = parseAllowedOrigins(PAGES);
  const h = corsHeaders("https://evil.example.com", allowed);
  assert.equal("Access-Control-Allow-Origin" in h, false);
  assert.equal(h["Vary"], "Origin"); // still varies
});

test("handlePreflight: allowed -> 204 with ACAO", () => {
  const req = new Request("https://api.example.com/api/subscriptions", {
    method: "OPTIONS",
    headers: { Origin: PAGES },
  });
  const res = handlePreflight(req, PAGES);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), PAGES);
});

test("handlePreflight: disallowed -> 403 without ACAO", () => {
  const req = new Request("https://api.example.com/api/subscriptions", {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example.com" },
  });
  const res = handlePreflight(req, PAGES);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});

test("withCors: merges ACAO onto an allowed response, preserves status/body", async () => {
  const req = new Request("https://api.example.com/api/metrics", {
    method: "GET",
    headers: { Origin: PAGES },
  });
  const base = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const res = withCors(base, req, PAGES);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), PAGES);
  assert.equal(res.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await res.json(), { ok: true });
});

test("withCors: disallowed origin -> no ACAO leaked", () => {
  const req = new Request("https://api.example.com/api/metrics", {
    method: "GET",
    headers: { Origin: "https://evil.example.com" },
  });
  const res = withCors(new Response("x", { status: 200 }), req, PAGES);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});

// ---------------------------------------------------------------------------
// db.js pure helpers
// ---------------------------------------------------------------------------

test("serializeTopics: cleans, dedups, sorts", () => {
  assert.equal(
    serializeTopics(["HH:ticket_open", "HH:ticket_open", " HH:cancel_window "]),
    JSON.stringify(["HH:cancel_window", "HH:ticket_open"])
  );
});

test("serializeTopics: junk -> '[]'", () => {
  assert.equal(serializeTopics(null), "[]");
  assert.equal(serializeTopics("nope"), "[]");
  assert.equal(serializeTopics([1, 2, ""]), "[]");
});

test("parseTopics: round-trips serialized value", () => {
  const s = serializeTopics(["HH:ticket_open", "OB:game_result"]);
  assert.deepEqual(parseTopics(s), ["HH:ticket_open", "OB:game_result"]);
});

test("parseTopics: fail-safe on bad JSON / empty", () => {
  assert.deepEqual(parseTopics("{not json"), []);
  assert.deepEqual(parseTopics(""), []);
  assert.deepEqual(parseTopics(undefined), []);
  assert.deepEqual(parseTopics('{"a":1}'), []); // object, not array
});

test("topicLikePattern: wraps quoted token (and escapes the _ wildcard)", () => {
  // '_' is a LIKE wildcard so it is escaped -> ticket\_open
  assert.equal(topicLikePattern("HH:ticket_open"), `%"HH:ticket\\_open"%`);
  assert.equal(topicLikePattern("HH:cancelwin"), `%"HH:cancelwin"%`);
});

test("topicLikePattern: escapes LIKE wildcards in topic", () => {
  // underscore is a LIKE wildcard; must be escaped
  assert.equal(topicLikePattern("a_b"), `%"a\\_b"%`);
  assert.equal(topicLikePattern("a%b"), `%"a\\%b"%`);
});

test("topicLikePattern matches serialized topics conceptually", () => {
  const stored = serializeTopics(["HH:ticket_open", "OB:game_result"]);
  // the inner quoted token must be a substring of the stored JSON
  assert.ok(stored.includes(`"HH:ticket_open"`));
  assert.ok(!stored.includes(`"LG:ticket_open"`));
});

test("upsertParams: builds positional bind array", () => {
  const sub = {
    endpoint: "https://push.example/abc",
    p256dh: "PKEY",
    auth: "AUTH",
    topics: ["HH:ticket_open"],
  };
  const params = upsertParams(sub, 1000, 5000);
  assert.deepEqual(params, [
    "https://push.example/abc",
    "PKEY",
    "AUTH",
    JSON.stringify(["HH:ticket_open"]),
    1000,
    5000,
  ]);
});

test("upsertParams: defaults expires_at to null", () => {
  const params = upsertParams(
    { endpoint: "e", p256dh: "p", auth: "a", topics: [] },
    42
  );
  assert.equal(params[5], null);
});

test("rowToSubscription: parses topics, normalizes expires_at", () => {
  const row = {
    endpoint: "e",
    p256dh: "p",
    auth: "a",
    topics: JSON.stringify(["HH:ticket_open"]),
    created_at: 100,
    expires_at: undefined,
  };
  assert.deepEqual(rowToSubscription(row), {
    endpoint: "e",
    p256dh: "p",
    auth: "a",
    topics: ["HH:ticket_open"],
    created_at: 100,
    expires_at: null,
  });
});

test("SQL: subscriptions upsert references no PII columns", () => {
  // sanity: the upsert column list must be exactly the minimal set
  const cols = ["endpoint", "p256dh", "auth", "topics", "created_at", "expires_at"];
  for (const c of cols) assert.ok(SQL.upsertSubscription.includes(c), `missing ${c}`);
  // Match banned names as whole word-boundary tokens (avoid false positives like
  // "ip" inside "subscriptions").
  for (const banned of ["ip", "user_agent", "country", "fingerprint", "uuid", "ua", "lat", "lng"]) {
    const re = new RegExp(`\\b${banned}\\b`, "i");
    assert.ok(!re.test(SQL.upsertSubscription), `PII column present: ${banned}`);
  }
});
