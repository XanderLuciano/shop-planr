/**
 * Feature: user-admin-roles
 * Property 7: Migration Username Deduplication
 * Property 8: Migration Data Preservation
 *
 * Property 7: For any set of pre-migration user rows where some share the same
 * `name` value, after migration, all `username` values should be unique. The first
 * occurrence (by rowid) should keep the original name as username, and subsequent
 * duplicates should have a numeric suffix appended.
 *
 * Property 8: For any set of pre-migration user rows, after migration, every user
 * should have `display_name` equal to their original `name`, and `username` should
 * start with their original `name` (possibly with a dedup suffix). The `is_admin`
 * field should default to `0` (false) for all existing users.
 *
 * **Validates: Requirements 1.4, 2.2, 8.1, 8.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { loadMigrationFiles } from '../../server/repositories/sqlite/index'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

/**
 * Create an in-memory DB and run migrations up to (and including) the given version.
 */
function createDbUpToVersion(maxVersion: number): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL
    )
  `)

  const migrations = loadMigrationFiles(MIGRATIONS_DIR)
    .filter(m => m.version <= maxVersion)

  for (const migration of migrations) {
    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      db.exec(migration.sql)
      db.prepare(
        'INSERT INTO _migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)'
      ).run(migration.version, migration.name, new Date().toISOString(), migration.checksum)
    })()
    db.pragma('foreign_keys = ON')
  }

  return db
}

/**
 * Run a single migration by version number on an existing DB.
 */
function runSingleMigration(db: Database.Database, version: number): void {
  const migration = loadMigrationFiles(MIGRATIONS_DIR).find(m => m.version === version)
  if (!migration) throw new Error(`Migration ${version} not found`)

  db.pragma('foreign_keys = OFF')
  db.transaction(() => {
    db.exec(migration.sql)
    db.prepare(
      'INSERT INTO _migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)'
    ).run(migration.version, migration.name, new Date().toISOString(), migration.checksum)
  })()
  db.pragma('foreign_keys = ON')
}

interface PreMigrationUser {
  id: string
  name: string
  insertionOrder: number
}

/**
 * Insert a user into the pre-009 schema (has `name` column, no `username`).
 */
function insertPreMigrationUser(db: Database.Database, id: string, name: string): void {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO users (id, name, department, active, created_at)
    VALUES (?, ?, NULL, 1, ?)
  `).run(id, name, now)
}

interface PostMigrationRow {
  id: string
  username: string
  display_name: string
  is_admin: number
}

/**
 * Arbitrary: non-empty name strings suitable for user names.
 * Uses printable ASCII to avoid SQLite encoding edge cases with control chars.
 */
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.'.split('')
const arbName = fc.array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 20 })
  .map(chars => chars.join(''))
  .filter(s => s.trim().length > 0)

/**
 * Arbitrary: array of name strings (1–12 items) with potential duplicates.
 * Uses a small pool of names to encourage duplicates.
 */
const arbNameListWithDuplicates = fc.array(arbName, { minLength: 1, maxLength: 5 })
  .chain(pool =>
    fc.array(
      fc.integer({ min: 0, max: 100 }).map(i => pool[i % pool.length]),
      { minLength: 1, maxLength: 12 }
    )
  )

describe('Properties 7 & 8: Migration Username Deduplication & Data Preservation', () => {
  it('Property 7: all usernames are unique after migration, first occurrence keeps original name, duplicates get _N suffix', () => {
    fc.assert(
      fc.property(arbNameListWithDuplicates, (names) => {
        const db = createDbUpToVersion(8)

        // Insert users with the generated names, tracking insertion order
        const users: PreMigrationUser[] = names.map((name, i) => ({
          id: `user_${i}`,
          name,
          insertionOrder: i,
        }))

        for (const u of users) {
          insertPreMigrationUser(db, u.id, u.name)
        }

        // Run migration 009
        runSingleMigration(db, 9)

        // Read all post-migration users
        const rows = db.prepare('SELECT id, username, display_name, is_admin FROM users').all() as PostMigrationRow[]
        const rowById = new Map(rows.map(r => [r.id, r]))

        expect(rows).toHaveLength(names.length)

        // All usernames must be unique
        const usernames = rows.map(r => r.username)
        expect(new Set(usernames).size).toBe(usernames.length)

        // Verify suffix assignment: track occurrence per name in insertion order
        const occurrenceCount = new Map<string, number>()
        for (const u of users) {
          const count = (occurrenceCount.get(u.name) ?? 0) + 1
          occurrenceCount.set(u.name, count)

          const row = rowById.get(u.id)!
          if (count === 1) {
            // First occurrence keeps original name as username
            expect(row.username).toBe(u.name)
          } else {
            // Subsequent duplicates get _N suffix (ROW_NUMBER gives 2, 3, etc.)
            expect(row.username).toBe(`${u.name}_${count}`)
          }
        }

        db.close()
      }),
      { numRuns: 100 }
    )
  })

  it('Property 8: display_name equals original name, username starts with original name, is_admin defaults to 0', () => {
    fc.assert(
      fc.property(arbNameListWithDuplicates, (names) => {
        const db = createDbUpToVersion(8)

        // Insert users with the generated names
        const users = names.map((name, i) => ({
          id: `user_${i}`,
          name,
        }))

        for (const u of users) {
          insertPreMigrationUser(db, u.id, u.name)
        }

        // Run migration 009
        runSingleMigration(db, 9)

        // Read all post-migration users
        const rows = db.prepare('SELECT id, username, display_name, is_admin FROM users').all() as PostMigrationRow[]
        const rowById = new Map(rows.map(r => [r.id, r]))

        expect(rows).toHaveLength(names.length)

        for (const u of users) {
          const row = rowById.get(u.id)!

          // display_name must equal the original name
          expect(row.display_name).toBe(u.name)

          // username must start with the original name (possibly with _N suffix)
          expect(row.username.startsWith(u.name)).toBe(true)

          // is_admin must default to 0
          expect(row.is_admin).toBe(0)
        }

        db.close()
      }),
      { numRuns: 100 }
    )
  })
})
