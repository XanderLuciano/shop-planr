-- 018_webhook_registrations.sql
-- Replace singleton webhook_config with multi-registration webhook system.
-- Adds webhook_registrations and webhook_deliveries tables.
-- Rebuilds webhook_events to drop columns now tracked per-delivery.
-- Drops webhook_config table.

-- ============================================================
-- 1. Create webhook_registrations table
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_registrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_types TEXT NOT NULL DEFAULT '[]',  -- JSON array: ["part_advanced", "job_created"]
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- 2. Rebuild webhook_events to drop dead columns
--    (status, sent_at, last_error, retry_count are now per-delivery)
-- ============================================================

CREATE TABLE webhook_events_new (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO webhook_events_new (id, event_type, payload, summary, created_at)
  SELECT id, event_type, payload, summary, created_at
  FROM webhook_events;

DROP TABLE webhook_events;
ALTER TABLE webhook_events_new RENAME TO webhook_events;

-- Recreate webhook_events indexes (drop status index, keep created_at)
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- ============================================================
-- 3. Create webhook_deliveries table
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL REFERENCES webhook_registrations(id),
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_registration_status ON webhook_deliveries(registration_id, status);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);

-- ============================================================
-- 4. Drop the singleton config table (replaced by registrations)
-- ============================================================

DROP TABLE IF EXISTS webhook_config;
