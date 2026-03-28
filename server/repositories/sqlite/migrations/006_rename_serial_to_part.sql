-- 006_rename_serial_to_part.sql
-- Rename "serial" terminology to "part" across all tables, columns, and indexes.
-- This is a pure refactoring — no behavioral changes, all data preserved.

-- ============================================================
-- 1. Simple table renames (no column changes needed within serials)
-- ============================================================

ALTER TABLE serials RENAME TO parts;
ALTER TABLE sn_step_statuses RENAME TO part_step_statuses;
ALTER TABLE sn_step_overrides RENAME TO part_step_overrides;

-- ============================================================
-- 2. Rename serial_id columns in the renamed tables
--    (SQLite 3.25+ supports ALTER TABLE RENAME COLUMN)
-- ============================================================

ALTER TABLE part_step_statuses RENAME COLUMN serial_id TO part_id;
ALTER TABLE part_step_overrides RENAME COLUMN serial_id TO part_id;

-- ============================================================
-- 3. Drop old indexes that reference old table/column names
-- ============================================================

-- Indexes on the old serials table (now parts)
DROP INDEX IF EXISTS idx_serials_job_id;
DROP INDEX IF EXISTS idx_serials_path_id;
DROP INDEX IF EXISTS idx_serials_step_index;

-- Indexes on old cert_attachments columns
DROP INDEX IF EXISTS idx_cert_attachments_serial;

-- Indexes on old audit_entries columns
DROP INDEX IF EXISTS idx_audit_serial;

-- Indexes on old sn_step_statuses (now part_step_statuses)
DROP INDEX IF EXISTS idx_sn_step_statuses_serial;
DROP INDEX IF EXISTS idx_sn_step_statuses_step;

-- Indexes on old sn_step_overrides (now part_step_overrides)
DROP INDEX IF EXISTS idx_sn_step_overrides_serial;
DROP INDEX IF EXISTS idx_sn_step_overrides_step;

-- ============================================================
-- 4. Recreate indexes with new names for renamed tables
-- ============================================================

-- parts (formerly serials)
CREATE INDEX idx_parts_job_id ON parts(job_id);
CREATE INDEX idx_parts_path_id ON parts(path_id);
CREATE INDEX idx_parts_step_index ON parts(current_step_index);

-- part_step_statuses (formerly sn_step_statuses)
CREATE INDEX idx_part_step_statuses_part ON part_step_statuses(part_id);
CREATE INDEX idx_part_step_statuses_step ON part_step_statuses(step_id);

-- part_step_overrides (formerly sn_step_overrides)
CREATE INDEX idx_part_step_overrides_part ON part_step_overrides(part_id);
CREATE INDEX idx_part_step_overrides_step ON part_step_overrides(step_id);

-- ============================================================
-- 5. Recreate cert_attachments with part_id column
--    (create-copy-drop-rename pattern for column rename)
-- ============================================================

CREATE TABLE cert_attachments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id TEXT NOT NULL REFERENCES parts(id),
  cert_id TEXT NOT NULL REFERENCES certs(id),
  step_id TEXT NOT NULL REFERENCES process_steps(id),
  attached_at TEXT NOT NULL,
  attached_by TEXT NOT NULL,
  UNIQUE(part_id, cert_id, step_id)
);

INSERT INTO cert_attachments_new (id, part_id, cert_id, step_id, attached_at, attached_by)
  SELECT id, serial_id, cert_id, step_id, attached_at, attached_by
  FROM cert_attachments;

DROP TABLE cert_attachments;
ALTER TABLE cert_attachments_new RENAME TO cert_attachments;

-- Recreate cert_attachments indexes
CREATE INDEX idx_cert_attachments_part ON cert_attachments(part_id);
CREATE INDEX idx_cert_attachments_cert ON cert_attachments(cert_id);

-- ============================================================
-- 6. Recreate audit_entries with part_id column
--    (create-copy-drop-rename pattern for column rename)
-- ============================================================

CREATE TABLE audit_entries_new (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  part_id TEXT,
  cert_id TEXT,
  job_id TEXT,
  path_id TEXT,
  step_id TEXT,
  from_step_id TEXT,
  to_step_id TEXT,
  batch_quantity INTEGER,
  metadata TEXT
);

INSERT INTO audit_entries_new (id, action, user_id, timestamp, part_id, cert_id, job_id, path_id, step_id, from_step_id, to_step_id, batch_quantity, metadata)
  SELECT id, action, user_id, timestamp, serial_id, cert_id, job_id, path_id, step_id, from_step_id, to_step_id, batch_quantity, metadata
  FROM audit_entries;

DROP TABLE audit_entries;
ALTER TABLE audit_entries_new RENAME TO audit_entries;

-- Recreate audit_entries indexes
CREATE INDEX idx_audit_part ON audit_entries(part_id);
CREATE INDEX idx_audit_job ON audit_entries(job_id);
CREATE INDEX idx_audit_timestamp ON audit_entries(timestamp);

-- ============================================================
-- 7. Update counters table: rename key 'sn' → 'part'
-- ============================================================

UPDATE counters SET name = 'part' WHERE name = 'sn';

-- ============================================================
-- 8. Update settings.page_toggles JSON: replace "serials" key
--    with "partsBrowser"
-- ============================================================

UPDATE settings
  SET page_toggles = REPLACE(page_toggles, '"serials"', '"partsBrowser"')
  WHERE page_toggles LIKE '%"serials"%';
