-- Webhook events queue table
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,       -- JSON: { user, time, partIds, jobId, stepId, ... }
  summary TEXT NOT NULL,       -- Human-readable one-liner: "PartAdvanced | admin | SN-00042 | Step 3 → Step 4"
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | failed
  created_at TEXT NOT NULL,
  sent_at TEXT,
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Webhook configuration table (singleton-ish, one row per endpoint for now)
CREATE TABLE IF NOT EXISTS webhook_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  endpoint_url TEXT NOT NULL DEFAULT '',
  enabled_event_types TEXT NOT NULL DEFAULT '[]',  -- JSON array of event type strings
  is_active INTEGER NOT NULL DEFAULT 0,            -- 1 = actively sending, 0 = paused
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
