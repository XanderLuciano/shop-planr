-- n8n Automations: stores workflow configurations that transform
-- Shop Planr webhook events and forward them to external services
-- via an n8n instance.

CREATE TABLE IF NOT EXISTS n8n_automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Which Shop Planr event types trigger this automation (JSON array of strings)
  event_types TEXT NOT NULL DEFAULT '[]',
  -- The n8n workflow JSON definition (nodes + connections)
  workflow_json TEXT NOT NULL DEFAULT '{}',
  -- Whether this automation is active
  enabled INTEGER NOT NULL DEFAULT 0,
  -- The n8n workflow ID once created on the n8n instance (null until deployed)
  n8n_workflow_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
