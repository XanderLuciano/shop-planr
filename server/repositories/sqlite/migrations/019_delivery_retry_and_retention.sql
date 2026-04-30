-- 019_delivery_retry_and_retention.sql
-- Add retry tracking (attempt_count, next_retry_at) to webhook_deliveries.

ALTER TABLE webhook_deliveries ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webhook_deliveries ADD COLUMN next_retry_at TEXT;
