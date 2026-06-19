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
