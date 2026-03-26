-- 005_add_page_toggles.sql
-- Add page_toggles column to settings for nav page visibility control

ALTER TABLE settings ADD COLUMN page_toggles TEXT NOT NULL DEFAULT '{}';
