-- Simplify BOM entries: each entry is now a single job + required quantity.
-- Replaces the old part_type + contributing_jobs multi-select model.

-- 1. Create the new simplified bom_entries table
CREATE TABLE bom_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bom_id TEXT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  required_quantity INTEGER NOT NULL DEFAULT 1
);

-- 2. Migrate existing data: for each old entry that had contributing jobs,
--    fan out to one row per (bom_id, job_id). When the same job appeared
--    across multiple old entries, keep the highest required quantity.
INSERT INTO bom_entries_new (bom_id, job_id, required_quantity)
SELECT be.bom_id, bcj.job_id, MAX(be.required_quantity_per_build)
FROM bom_entries be
JOIN bom_contributing_jobs bcj ON bcj.bom_entry_id = be.id
GROUP BY be.bom_id, bcj.job_id;

-- 3. Drop old tables (contributing_jobs first due to FK)
DROP TABLE IF EXISTS bom_contributing_jobs;
DROP TABLE IF EXISTS bom_entries;

-- 4. Rename new table
ALTER TABLE bom_entries_new RENAME TO bom_entries;

-- 5. Add indexes
CREATE INDEX idx_bom_entries_bom ON bom_entries(bom_id);
CREATE INDEX idx_bom_entries_job ON bom_entries(job_id);

-- 6. Unique constraint: a job can only appear once per BOM
CREATE UNIQUE INDEX idx_bom_entries_bom_job ON bom_entries(bom_id, job_id);
