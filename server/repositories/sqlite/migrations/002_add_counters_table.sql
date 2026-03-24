-- 002_add_counters_table.sql
-- Serial number counter persistence for sequential SN generation

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
