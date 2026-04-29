-- 020_delivery_registration_nullable.sql
-- Make registration_id nullable with ON DELETE SET NULL so that
-- deleting a registration preserves delivery history instead of
-- causing an FK violation.

CREATE TABLE webhook_deliveries_new (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  registration_id TEXT REFERENCES webhook_registrations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO webhook_deliveries_new (id, event_id, registration_id, status, error, attempt_count, next_retry_at, created_at, updated_at)
  SELECT id, event_id, registration_id, status, error, attempt_count, next_retry_at, created_at, updated_at
  FROM webhook_deliveries;

DROP TABLE webhook_deliveries;
ALTER TABLE webhook_deliveries_new RENAME TO webhook_deliveries;

-- Recreate indexes
CREATE INDEX idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_registration_status ON webhook_deliveries(registration_id, status);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
