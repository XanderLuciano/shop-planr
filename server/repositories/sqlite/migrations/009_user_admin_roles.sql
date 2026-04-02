-- 009_user_admin_roles.sql
-- Replace `name` column with `username`, `display_name`, and `is_admin`.
-- Uses table-recreation pattern to apply NOT NULL constraints and handle
-- duplicate name → username deduplication via ROW_NUMBER() window function.

-- ============================================================
-- 1. Create users_new with target schema (no `name` column)
-- ============================================================

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  department TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ============================================================
-- 2. Copy data, deduplicating username from name
--    First occurrence (by rowid) keeps name as-is.
--    Subsequent duplicates get _2, _3, etc.
-- ============================================================

INSERT INTO users_new (id, username, display_name, department, is_admin, active, created_at)
SELECT
  id,
  CASE
    WHEN rn = 1 THEN name
    ELSE name || '_' || (rn)
  END AS username,
  name AS display_name,
  department,
  0 AS is_admin,
  active,
  created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY rowid) AS rn
  FROM users
);

-- ============================================================
-- 3. Drop old table, rename new table
-- ============================================================

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- ============================================================
-- 4. Create unique index on username
-- ============================================================

CREATE UNIQUE INDEX idx_users_username ON users(username);
