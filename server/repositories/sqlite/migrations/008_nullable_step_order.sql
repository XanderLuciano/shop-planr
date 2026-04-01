-- 008_nullable_step_order.sql
-- Make step_order nullable on process_steps so soft-deleted steps can have
-- NULL order instead of negative sentinel values. SQLite treats NULLs as
-- distinct in UNIQUE constraints, so UNIQUE(path_id, step_order) still
-- protects active steps while allowing unlimited soft-deleted steps.

-- Rebuild process_steps with step_order INTEGER (nullable)
CREATE TABLE process_steps_new (
  id TEXT PRIMARY KEY,
  path_id TEXT NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INTEGER,
  location TEXT,
  assigned_to TEXT REFERENCES users(id),
  optional INTEGER NOT NULL DEFAULT 0,
  dependency_type TEXT NOT NULL DEFAULT 'preferred',
  removed_at TEXT,
  completed_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(path_id, step_order)
);

INSERT INTO process_steps_new (
  id, path_id, name, step_order, location, assigned_to,
  optional, dependency_type, removed_at, completed_count
)
SELECT
  id, path_id, name,
  CASE WHEN removed_at IS NOT NULL THEN NULL ELSE step_order END,
  location, assigned_to,
  optional, dependency_type, removed_at, completed_count
FROM process_steps;

DROP TABLE process_steps;
ALTER TABLE process_steps_new RENAME TO process_steps;

-- Recreate indexes
CREATE INDEX idx_process_steps_path ON process_steps(path_id);
CREATE INDEX idx_process_steps_assigned_to ON process_steps(assigned_to);
