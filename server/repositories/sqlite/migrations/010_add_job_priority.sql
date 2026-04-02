-- 009_add_job_priority.sql
-- Add priority column to jobs table for shop-floor ordering (1 = highest priority)

ALTER TABLE jobs ADD COLUMN priority INTEGER;

-- Backfill: assign sequential priority based on creation order (oldest = 1)
UPDATE jobs SET priority = (
  SELECT COUNT(*) FROM jobs j2 WHERE j2.created_at <= jobs.created_at
);

CREATE INDEX idx_jobs_priority ON jobs(priority);
