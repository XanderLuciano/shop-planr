-- Add archived_at column to boms table for soft-delete/archive support
ALTER TABLE boms ADD COLUMN archived_at TEXT DEFAULT NULL;
