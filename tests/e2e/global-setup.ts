/**
 * Playwright global setup.
 *
 * Resets the e2e test database to a known state before the suite runs.
 *
 * IMPORTANT: Playwright starts the webServer *before* running globalSetup,
 * so the Nuxt dev server already has an open SQLite connection to test.db.
 * We must NOT delete the file (that would orphan the server's file handle).
 * Instead we truncate all tables in-place and re-seed, keeping the same
 * inode so the server's connection stays valid.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'

const TEST_DB = resolve(process.cwd(), 'data', 'test.db')

export default async function globalSetup(): Promise<void> {
  console.log('[e2e] Resetting test DB at', TEST_DB)

  // Ensure the data directory exists (CI fresh checkout).
  const dir = dirname(TEST_DB)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // If the DB already exists (server created it), wipe all user data in-place
  // so the server's open connection sees the reset immediately.
  if (existsSync(TEST_DB)) {
    const db = new Database(TEST_DB)
    try {
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = OFF')

      // Get all user-created tables (skip internal _migrations table and sqlite internals)
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name != '_migrations'
      `).all() as { name: string }[]

      db.transaction(() => {
        for (const { name } of tables) {
          db.prepare(`DELETE FROM "${name}"`).run()
        }
      })()

      db.pragma('foreign_keys = ON')
    } finally {
      db.close()
    }
  }

  // Run the seed script which handles migrations + SAMPLE- data insertion.
  // If the DB didn't exist yet, the seed script creates it from scratch.
  execSync(`npx tsx server/scripts/seed.ts ${TEST_DB}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
}
