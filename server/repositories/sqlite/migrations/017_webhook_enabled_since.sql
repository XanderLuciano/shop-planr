-- Track when each event type was enabled so we don't retroactively dispatch old events
ALTER TABLE webhook_config ADD COLUMN enabled_since TEXT NOT NULL DEFAULT '{}';
