-- 010_priority_not_null_resequence.sql
-- Fix: re-sequence priorities to break ties from 009 backfill (identical created_at),
-- and add NOT NULL DEFAULT 0 constraint for defensive data integrity.

-- Step 1: Ensure no NULL priorities exist before re-sequencing
UPDATE jobs SET priority = 0 WHERE priority IS NULL;

-- Step 2: Re-sequence priorities using rowid as tiebreaker for identical created_at
UPDATE jobs SET priority = (
  SELECT COUNT(*) FROM jobs j2
  WHERE j2.created_at < jobs.created_at
     OR (j2.created_at = jobs.created_at AND j2.rowid <= jobs.rowid)
);

-- Step 3: Recreate table with NOT NULL DEFAULT 0 constraint on priority
CREATE TABLE jobs_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal_quantity INTEGER NOT NULL CHECK(goal_quantity > 0),
  priority INTEGER NOT NULL DEFAULT 0,
  jira_ticket_key TEXT,
  jira_ticket_summary TEXT,
  jira_part_number TEXT,
  jira_priority TEXT,
  jira_epic_link TEXT,
  jira_labels TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO jobs_new SELECT * FROM jobs;
DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;

CREATE INDEX idx_jobs_priority ON jobs(priority);
