-- 004_lifecycle_management.sql
-- Adds lifecycle columns, new tables, and seed data for job lifecycle management

-- 1. Extend serials table with lifecycle fields
ALTER TABLE serials ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE serials ADD COLUMN scrap_reason TEXT;
ALTER TABLE serials ADD COLUMN scrap_explanation TEXT;
ALTER TABLE serials ADD COLUMN scrap_step_id TEXT;
ALTER TABLE serials ADD COLUMN scrapped_at TEXT;
ALTER TABLE serials ADD COLUMN scrapped_by TEXT;
ALTER TABLE serials ADD COLUMN force_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE serials ADD COLUMN force_completed_by TEXT;
ALTER TABLE serials ADD COLUMN force_completed_at TEXT;
ALTER TABLE serials ADD COLUMN force_completed_reason TEXT;

-- Migrate existing completed serials
UPDATE serials SET status = 'completed' WHERE current_step_index = -1;

-- 2. Extend process_steps with optional and dependency_type
ALTER TABLE process_steps ADD COLUMN optional INTEGER NOT NULL DEFAULT 0;
ALTER TABLE process_steps ADD COLUMN dependency_type TEXT NOT NULL DEFAULT 'preferred';

-- 3. Extend template_steps with optional and dependency_type
ALTER TABLE template_steps ADD COLUMN optional INTEGER NOT NULL DEFAULT 0;
ALTER TABLE template_steps ADD COLUMN dependency_type TEXT NOT NULL DEFAULT 'preferred';

-- 4. Extend paths with advancement_mode
ALTER TABLE paths ADD COLUMN advancement_mode TEXT NOT NULL DEFAULT 'strict';

-- 5. Per-SN step status tracking
CREATE TABLE sn_step_statuses (
  id TEXT PRIMARY KEY,
  serial_id TEXT NOT NULL REFERENCES serials(id),
  step_id TEXT NOT NULL REFERENCES process_steps(id),
  step_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TEXT NOT NULL,
  UNIQUE(serial_id, step_id)
);

CREATE INDEX idx_sn_step_statuses_serial ON sn_step_statuses(serial_id);
CREATE INDEX idx_sn_step_statuses_step ON sn_step_statuses(step_id);

-- 6. Per-SN step overrides (prototype fast-track)
CREATE TABLE sn_step_overrides (
  id TEXT PRIMARY KEY,
  serial_id TEXT NOT NULL REFERENCES serials(id),
  step_id TEXT NOT NULL REFERENCES process_steps(id),
  active INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sn_step_overrides_serial ON sn_step_overrides(serial_id);
CREATE INDEX idx_sn_step_overrides_step ON sn_step_overrides(step_id);

-- 7. BOM version history
CREATE TABLE bom_versions (
  id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL REFERENCES boms(id),
  version_number INTEGER NOT NULL,
  entries_snapshot TEXT NOT NULL,
  change_description TEXT,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_bom_versions_bom ON bom_versions(bom_id);

-- 8. Process library
CREATE TABLE process_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- 9. Location library
CREATE TABLE location_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- 10. Seed default process library entries
INSERT OR IGNORE INTO process_library (id, name, created_at) VALUES
  ('plib_cnc', 'CNC Machine', datetime('now')),
  ('plib_insp', 'Inspection', datetime('now')),
  ('plib_chem', 'Chemfilm', datetime('now')),
  ('plib_stress', 'Stress Relief', datetime('now')),
  ('plib_pin', 'Pinning', datetime('now')),
  ('plib_coat', 'Coating', datetime('now')),
  ('plib_spdt', 'SPDT', datetime('now')),
  ('plib_nano', 'Nano Black', datetime('now'));

-- 11. Seed default location library entries
INSERT OR IGNORE INTO location_library (id, name, created_at) VALUES
  ('lloc_shop', 'Machine Shop', datetime('now')),
  ('lloc_qc', 'QC Lab', datetime('now')),
  ('lloc_vendor', 'Vendor', datetime('now'));
