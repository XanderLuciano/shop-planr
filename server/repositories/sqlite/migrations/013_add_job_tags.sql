-- Tags: user-defined labels for categorizing jobs
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Case-insensitive unique constraint on tag name
CREATE UNIQUE INDEX idx_tags_name_lower ON tags(LOWER(name));

-- Join table: many-to-many between jobs and tags
CREATE TABLE job_tags (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, tag_id)
);

-- Index for efficient reverse lookup (which jobs use a given tag)
CREATE INDEX idx_job_tags_tag_id ON job_tags(tag_id);
