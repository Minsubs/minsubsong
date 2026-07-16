-- worker/schema.sql
-- D1 schema for the KBO TIDO push backend.
--
-- PRIVACY (docs/BACKEND_PUSH_PLAN.md §4.1, §4.5):
--   Stored data is the minimum required to deliver a Web Push message.
--   There are NO PII columns: no ip, no user_agent, no country/location,
--   no device fingerprint, no client UUID, no email/phone/name.
--   `endpoint` is the anonymous primary key AND a bearer secret — never log it
--   in plaintext (mask/hash via maskEndpoint before any logging).
--
-- Apply with: wrangler d1 execute <DB> --file=worker/schema.sql

-- Anonymous push subscriptions. endpoint = PK = anonymous identity.
CREATE TABLE IF NOT EXISTS subscriptions (
  endpoint    TEXT PRIMARY KEY,            -- bearer secret; mask before logging
  p256dh      TEXT NOT NULL,               -- client public key (payload encryption)
  auth        TEXT NOT NULL,               -- auth secret (payload encryption)
  topics      TEXT NOT NULL DEFAULT '[]',  -- JSON array, e.g. '["HH:ticket_open"]'
  created_at  INTEGER NOT NULL,            -- epoch ms, UTC
  expires_at  INTEGER                      -- epoch ms, UTC; NULL = no TTL
  -- NO ip / user_agent / country / fingerprint / uuid / contact columns.
);

-- Substring search on the JSON topics array (getByTopic uses LIKE).
CREATE INDEX IF NOT EXISTS idx_subscriptions_topics ON subscriptions (topics);
-- TTL reaping scans expires_at.
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions (expires_at);

-- Send log: enforces the "once per game/event" frequency cap server-side.
-- dedup_key is the per-event idempotency key (e.g. game id + topic).
-- (endpoint, dedup_key) is unique so markSent is idempotent.
CREATE TABLE IF NOT EXISTS sent_log (
  endpoint   TEXT NOT NULL,   -- references a subscription; mask before logging
  topic      TEXT NOT NULL,   -- e.g. 'HH:ticket_open'
  dedup_key  TEXT NOT NULL,   -- per-event key, e.g. 'ticket_open:<gameId>'
  sent_at    INTEGER NOT NULL,-- epoch ms, UTC
  PRIMARY KEY (endpoint, dedup_key)
);

-- getSentForGame looks up by dedup_key.
CREATE INDEX IF NOT EXISTS idx_sent_log_dedup ON sent_log (dedup_key);
-- Old-log pruning scans sent_at.
CREATE INDEX IF NOT EXISTS idx_sent_log_sent_at ON sent_log (sent_at);

-- Anonymous aggregate demand counters. AGGREGATE COUNTS ONLY — no per-user
-- rows, no identifiers. One row per (metric, UTC day).
CREATE TABLE IF NOT EXISTS demand_counters (
  metric  TEXT NOT NULL,    -- e.g. 'active_user', 'ticket_open_click', 'team:HH'
  day     TEXT NOT NULL,    -- UTC day 'YYYY-MM-DD'
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric, day)
);

-- F3. Reschedule (double-header) detection baseline. Records which calendar
-- game_ids have been observed and when they FIRST appeared. A game whose
-- first_seen_at is "now" while the table is already populated (season running)
-- and whose game date is near is a reschedule candidate. NO PII — game_id is a
-- deterministic key derived from public schedule fields (home+date+time).
CREATE TABLE IF NOT EXISTS calendar_seen (
  game_id       TEXT PRIMARY KEY,  -- deterministic key (push-logic gameIdOf)
  first_seen_at INTEGER NOT NULL   -- epoch ms, UTC; kept on first insert (idempotent)
);

-- F4. Live game state snapshot for scoreboard diffing. One row per game_key
-- (team codes + KST date). Holds only public scoreboard-derived values plus a
-- missing_count for the cancel diff (game absent from scoreboard N ticks).
-- NO PII. Pruned by updated_at (yesterday's games).
CREATE TABLE IF NOT EXISTS live_state (
  game_key      TEXT PRIMARY KEY,  -- e.g. '2026-07-15:HH@LG'
  home_score    INTEGER,           -- NULL before first score / pre-game
  away_score    INTEGER,
  state         TEXT,              -- raw scoreboard state string ('18:30'/'FINAL'/'TOP 5')
  missing_count INTEGER NOT NULL DEFAULT 0, -- consecutive ticks absent (cancel diff)
  last_change_at INTEGER,          -- epoch ms; tick where state/score last changed (delayed/stalled diff)
  updated_at    INTEGER NOT NULL   -- epoch ms, UTC
);

-- Pruning scans updated_at.
CREATE INDEX IF NOT EXISTS idx_live_state_updated ON live_state (updated_at);
