-- 023_add_n8n_connection.sql
-- Add n8n_connection column to settings so admins can manage the n8n
-- integration from the UI instead of having to edit server env vars and
-- redeploy. The settingsService seeds this with env var defaults the first
-- time settings are written, so existing .env-driven deployments keep
-- working with zero intervention.

ALTER TABLE settings
  ADD COLUMN n8n_connection TEXT NOT NULL
  DEFAULT '{"baseUrl":"","apiKey":"","enabled":false}';
