-- 003_add_step_assignment.sql
-- Add assigned_to column to process_steps for operator assignment

ALTER TABLE process_steps ADD COLUMN assigned_to TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_process_steps_assigned_to ON process_steps(assigned_to);
