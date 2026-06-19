// worker/lib/db.js
//
// D1 prepared-statement wrappers for the KBO TIDO push backend.
//
// Privacy (docs/BACKEND_PUSH_PLAN.md §4):
//   - Tables hold endpoint/p256dh/auth/topics/created_at(+expires_at) ONLY.
//     NO IP, User-Agent, location, fingerprint, UUID, or any PII.
//   - endpoint is the anonymous primary key AND a bearer secret. It is NEVER
//     serialized into logs here. Use maskEndpoint (push-logic.js) before logging.
//   - sent_log enforces the "once per game" frequency cap server-side.
//   - demand_counters stores aggregate counts only (no per-user rows).
//
// Design: SQL strings + parameter-building are kept as pure, exported helpers so
// they can be unit tested without a live D1 binding. The DB-bound functions are
// thin: bind params -> run. `topics` is stored as a JSON string column.

// ---------------------------------------------------------------------------
// SQL constants (pure)
// ---------------------------------------------------------------------------

export const SQL = {
  upsertSubscription: `
    INSERT INTO subscriptions (endpoint, p256dh, auth, topics, created_at, expires_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      topics     = excluded.topics,
      expires_at = excluded.expires_at
  `,
  deleteSubscription: `DELETE FROM subscriptions WHERE endpoint = ?1`,
  getByTopic: `
    SELECT endpoint, p256dh, auth, topics, created_at, expires_at
    FROM subscriptions
    WHERE topics LIKE ?1
  `,
  markSent: `
    INSERT INTO sent_log (endpoint, topic, dedup_key, sent_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(endpoint, dedup_key) DO NOTHING
  `,
  getSentForGame: `
    SELECT endpoint, topic, dedup_key, sent_at
    FROM sent_log
    WHERE dedup_key = ?1
  `,
  deleteExpiredSubscriptions: `
    DELETE FROM subscriptions
    WHERE expires_at IS NOT NULL AND expires_at < ?1
  `,
  deleteOldSentLog: `DELETE FROM sent_log WHERE sent_at < ?1`,
  insertEventCounts: `
    INSERT INTO demand_counters (metric, day, count)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(metric, day) DO UPDATE SET
      count = count + excluded.count
  `,
  getMetrics: `
    SELECT metric, day, count
    FROM demand_counters
    ORDER BY day DESC, metric ASC
  `,
};

// ---------------------------------------------------------------------------
// Pure helpers (testable without D1)
// ---------------------------------------------------------------------------

/**
 * Serialize a topics array to the stored JSON string.
 * Normalizes: array of non-empty strings, de-duplicated, sorted for stable
 * LIKE matching and storage. Non-arrays / junk -> "[]".
 * @param {unknown} topics
 * @returns {string}
 */
export function serializeTopics(topics) {
  if (!Array.isArray(topics)) return "[]";
  const cleaned = [
    ...new Set(
      topics
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    ),
  ].sort();
  return JSON.stringify(cleaned);
}

/**
 * Parse the stored topics JSON string back to an array. Fail-safe -> [].
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseTopics(raw) {
  if (Array.isArray(raw)) return raw.filter((t) => typeof t === "string");
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Build the LIKE pattern that matches a single topic inside the serialized
 * JSON topics column. Topics are stored as a JSON array of quoted strings, so
 * we match the quoted token. We escape LIKE wildcards in the topic itself.
 * @param {string} topic
 * @returns {string}
 */
export function topicLikePattern(topic) {
  const t = String(topic).replace(/([%_\\])/g, "\\$1");
  // matches ..."topic"... within the JSON array string
  return `%"${t}"%`;
}

/**
 * Build the bind params for an upsert from a validated subscription object.
 * created_at is only set on insert (the upsert keeps the original via the
 * ON CONFLICT clause not touching created_at).
 * @param {{endpoint:string,p256dh:string,auth:string,topics:string[]}} sub
 * @param {number} nowMs
 * @param {number|null} expiresAtMs
 * @returns {[string,string,string,string,number,number|null]}
 */
export function upsertParams(sub, nowMs, expiresAtMs = null) {
  return [
    sub.endpoint,
    sub.p256dh,
    sub.auth,
    serializeTopics(sub.topics),
    nowMs,
    expiresAtMs,
  ];
}

/**
 * Normalize a DB subscription row into the shape used by push-logic
 * (parsed topics array). Does not log or expose anything extra.
 * @param {Record<string,any>} row
 * @returns {{endpoint:string,p256dh:string,auth:string,topics:string[],created_at:number,expires_at:number|null}}
 */
export function rowToSubscription(row) {
  return {
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    topics: parseTopics(row.topics),
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// D1-bound wrappers (thin; require an env.DB D1Database binding)
// ---------------------------------------------------------------------------

/**
 * Upsert (insert or update) a subscription.
 * @param {D1Database} db
 * @param {{endpoint:string,p256dh:string,auth:string,topics:string[]}} sub
 * @param {number} nowMs
 * @param {number|null} expiresAtMs
 */
export async function upsertSubscription(db, sub, nowMs, expiresAtMs = null) {
  return db
    .prepare(SQL.upsertSubscription)
    .bind(...upsertParams(sub, nowMs, expiresAtMs))
    .run();
}

/**
 * Delete a subscription by endpoint (unsubscribe / 410 / 404 reaping).
 * @param {D1Database} db
 * @param {string} endpoint
 */
export async function deleteSubscription(db, endpoint) {
  return db.prepare(SQL.deleteSubscription).bind(endpoint).run();
}

/**
 * Fetch all subscriptions whose topics array contains the given topic.
 * @param {D1Database} db
 * @param {string} topic
 * @returns {Promise<Array>} array of normalized subscription objects
 */
export async function getByTopic(db, topic) {
  const { results } = await db
    .prepare(SQL.getByTopic)
    .bind(topicLikePattern(topic))
    .all();
  return (results || []).map(rowToSubscription);
}

/**
 * Record that a push was sent for a (endpoint, dedup_key). Idempotent via
 * the unique constraint -> implements the "once per game" cap.
 * @param {D1Database} db
 * @param {string} endpoint
 * @param {string} topic
 * @param {string} dedupKey
 * @param {number} sentAtMs
 */
export async function markSent(db, endpoint, topic, dedupKey, sentAtMs) {
  return db
    .prepare(SQL.markSent)
    .bind(endpoint, topic, dedupKey, sentAtMs)
    .run();
}

/**
 * Get all sent-log rows for a given dedup_key (e.g. a game) so the sender can
 * skip already-notified endpoints.
 * @param {D1Database} db
 * @param {string} dedupKey
 * @returns {Promise<Array>}
 */
export async function getSentForGame(db, dedupKey) {
  const { results } = await db.prepare(SQL.getSentForGame).bind(dedupKey).all();
  return results || [];
}

/**
 * Delete subscriptions past their expires_at (TTL reaping).
 * @param {D1Database} db
 * @param {number} nowMs
 */
export async function deleteExpired(db, nowMs) {
  return db.prepare(SQL.deleteExpiredSubscriptions).bind(nowMs).run();
}

/**
 * Insert/accumulate anonymous aggregate event counts. `counts` is a map of
 * metric -> integer count for a given UTC day string (YYYY-MM-DD). Uses a D1
 * batch for atomicity. NO per-user data is stored.
 * @param {D1Database} db
 * @param {Record<string,number>} counts
 * @param {string} day - UTC day, "YYYY-MM-DD"
 */
export async function insertEventCounts(db, counts, day) {
  const stmt = db.prepare(SQL.insertEventCounts);
  const batch = Object.entries(counts)
    .filter(([, n]) => Number.isFinite(n) && n > 0)
    .map(([metric, n]) => stmt.bind(metric, day, Math.trunc(n)));
  if (batch.length === 0) return [];
  return db.batch(batch);
}

/**
 * Read aggregate demand metrics (counts only).
 * @param {D1Database} db
 * @returns {Promise<Array<{metric:string,day:string,count:number}>>}
 */
export async function getMetrics(db) {
  const { results } = await db.prepare(SQL.getMetrics).all();
  return results || [];
}
