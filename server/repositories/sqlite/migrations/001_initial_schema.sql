-- 001_initial_schema.sql
-- Initial database schema for SHOP_ERP

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal_quantity INTEGER NOT NULL CHECK(goal_quantity > 0),
  jira_ticket_key TEXT,
  jira_ticket_summary TEXT,
  jira_part_number TEXT,
  jira_priority TEXT,
  jira_epic_link TEXT,
  jira_labels TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Paths
CREATE TABLE IF NOT EXISTS paths (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  name TEXT NOT NULL,
  goal_quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Process Steps (belong to a path, ordered)
CREATE TABLE IF NOT EXISTS process_steps (
  id TEXT PRIMARY KEY,
  path_id TEXT NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  location TEXT,
  UNIQUE(path_id, step_order)
);

-- Serial Numbers
CREATE TABLE IF NOT EXISTS serials (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  path_id TEXT NOT NULL REFERENCES paths(id),
  current_step_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Certificates
CREATE TABLE IF NOT EXISTS certs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('material', 'process')),
  name TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

-- Certificate attachments (many-to-many: serials <-> certs)
CREATE TABLE IF NOT EXISTS cert_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_id TEXT NOT NULL REFERENCES serials(id),
  cert_id TEXT NOT NULL REFERENCES certs(id),
  step_id TEXT NOT NULL REFERENCES process_steps(id),
  attached_at TEXT NOT NULL,
  attached_by TEXT NOT NULL,
  UNIQUE(serial_id, cert_id, step_id)
);

-- Template Routes
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  location TEXT,
  UNIQUE(template_id, step_order)
);

-- BOM
CREATE TABLE IF NOT EXISTS boms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bom_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bom_id TEXT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  part_type TEXT NOT NULL,
  required_quantity_per_build INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bom_contributing_jobs (
  bom_entry_id INTEGER NOT NULL REFERENCES bom_entries(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  PRIMARY KEY(bom_entry_id, job_id)
);

-- Users (simple kiosk mode — no passwords)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Audit Trail (append-only — no UPDATE or DELETE allowed by service layer)
CREATE TABLE IF NOT EXISTS audit_entries (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  serial_id TEXT,
  cert_id TEXT,
  job_id TEXT,
  path_id TEXT,
  step_id TEXT,
  from_step_id TEXT,
  to_step_id TEXT,
  batch_quantity INTEGER,
  metadata TEXT
);

-- Settings (singleton row)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'app_settings',
  jira_connection TEXT NOT NULL,
  jira_field_mappings TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Process Step Notes / Defects
CREATE TABLE IF NOT EXISTS step_notes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  path_id TEXT NOT NULL REFERENCES paths(id),
  step_id TEXT NOT NULL REFERENCES process_steps(id),
  serial_ids TEXT NOT NULL,
  text TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pushed_to_jira INTEGER NOT NULL DEFAULT 0,
  jira_comment_id TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_paths_job_id ON paths(job_id);
CREATE INDEX IF NOT EXISTS idx_serials_job_id ON serials(job_id);
CREATE INDEX IF NOT EXISTS idx_serials_path_id ON serials(path_id);
CREATE INDEX IF NOT EXISTS idx_serials_step_index ON serials(current_step_index);
CREATE INDEX IF NOT EXISTS idx_cert_attachments_serial ON cert_attachments(serial_id);
CREATE INDEX IF NOT EXISTS idx_cert_attachments_cert ON cert_attachments(cert_id);
CREATE INDEX IF NOT EXISTS idx_audit_serial ON audit_entries(serial_id);
CREATE INDEX IF NOT EXISTS idx_audit_job ON audit_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_process_steps_path ON process_steps(path_id);
CREATE INDEX IF NOT EXISTS idx_step_notes_step ON step_notes(step_id);
CREATE INDEX IF NOT EXISTS idx_step_notes_job ON step_notes(job_id);
