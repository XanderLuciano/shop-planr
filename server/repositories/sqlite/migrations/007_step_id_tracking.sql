-- 007_step_id_tracking.sql
-- Replace integer current_step_index with current_step_id (TEXT FK to process_steps).
-- Overhaul part_step_statuses for full routing history (sequence numbers, no UNIQUE).
-- Add soft-delete (removed_at) and write-time counter (completed_count) to process_steps.
-- Entire migration runs in a single transaction.

-- ============================================================
-- 1. Add current_step_id column to parts
-- ============================================================

ALTER TABLE parts ADD COLUMN current_step_id TEXT REFERENCES process_steps(id);

-- ============================================================
-- 2. Backfill current_step_id from current_step_index
--    Active parts (index >= 0): look up step ID by path_id + step_order
--    Completed parts (index = -1): leave NULL (already NULL by default)
-- ============================================================

UPDATE parts SET current_step_id = (
  SELECT ps.id FROM process_steps ps
  WHERE ps.path_id = parts.path_id
    AND ps.step_order = parts.current_step_index
) WHERE current_step_index >= 0;

-- Orphaned step indexes: any active part whose current_step_id is still NULL
-- after the backfill had an index with no matching process_step row.
-- We leave current_step_id = NULL for these (logged as warning at app level).
-- No SQL-level logging available; the application migration runner should
-- detect rows where current_step_index >= 0 AND current_step_id IS NULL
-- and emit a warning.

-- ============================================================
-- 3. Add removed_at and completed_count to process_steps
-- ============================================================

ALTER TABLE process_steps ADD COLUMN removed_at TEXT;
ALTER TABLE process_steps ADD COLUMN completed_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 4. Backfill completed_count from existing routing history
-- ============================================================

UPDATE process_steps SET completed_count = (
  SELECT COUNT(DISTINCT part_id) FROM part_step_statuses
  WHERE part_step_statuses.step_id = process_steps.id
    AND part_step_statuses.status = 'completed'
);

-- ============================================================
-- 5. Rebuild parts table without current_step_index
--    (create-copy-drop-rename pattern for SQLite)
-- ============================================================

CREATE TABLE parts_new (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  path_id TEXT NOT NULL REFERENCES paths(id),
  current_step_id TEXT REFERENCES process_steps(id),
  status TEXT NOT NULL DEFAULT 'in_progress',
  scrap_reason TEXT,
  scrap_explanation TEXT,
  scrap_step_id TEXT,
  scrapped_at TEXT,
  scrapped_by TEXT,
  force_completed INTEGER NOT NULL DEFAULT 0,
  force_completed_by TEXT,
  force_completed_at TEXT,
  force_completed_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO parts_new (
  id, job_id, path_id, current_step_id, status,
  scrap_reason, scrap_explanation, scrap_step_id, scrapped_at, scrapped_by,
  force_completed, force_completed_by, force_completed_at, force_completed_reason,
  created_at, updated_at
)
SELECT
  id, job_id, path_id, current_step_id, status,
  scrap_reason, scrap_explanation, scrap_step_id, scrapped_at, scrapped_by,
  force_completed, force_completed_by, force_completed_at, force_completed_reason,
  created_at, updated_at
FROM parts;

DROP TABLE parts;
ALTER TABLE parts_new RENAME TO parts;

-- ============================================================
-- 6. Recreate parts indexes
-- ============================================================

CREATE INDEX idx_parts_job_id ON parts(job_id);
CREATE INDEX idx_parts_path_id ON parts(path_id);
CREATE INDEX idx_parts_current_step_id ON parts(current_step_id);

-- ============================================================
-- 7. Rebuild part_step_statuses
--    Remove UNIQUE(part_id, step_id), remove step_index,
--    add sequence_number, entered_at, completed_at
-- ============================================================

CREATE TABLE part_step_statuses_new (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES parts(id),
  step_id TEXT NOT NULL REFERENCES process_steps(id),
  sequence_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  entered_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO part_step_statuses_new (
  id, part_id, step_id, sequence_number, status,
  entered_at, completed_at, updated_at
)
SELECT
  id, part_id, step_id, 1, status,
  updated_at, NULL, updated_at
FROM part_step_statuses;

DROP TABLE part_step_statuses;
ALTER TABLE part_step_statuses_new RENAME TO part_step_statuses;

-- ============================================================
-- 8. Recreate part_step_statuses indexes
-- ============================================================

CREATE INDEX idx_part_step_statuses_part ON part_step_statuses(part_id);
CREATE INDEX idx_part_step_statuses_step ON part_step_statuses(step_id);
CREATE INDEX idx_part_step_statuses_part_step ON part_step_statuses(part_id, step_id, sequence_number);
