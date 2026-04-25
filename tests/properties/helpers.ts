/**
 * Shared helpers for property tests.
 *
 * Creates a single migrated in-memory SQLite database per test file.
 * Uses SAVEPOINT/ROLLBACK TO between iterations for near-zero-cost resets
 * instead of creating a new DB + running 14 migrations per iteration.
 */
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { createTestContext } from '../integration/helpers'
import type { TestContext } from '../integration/helpers'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

/**
 * Create a migrated in-memory database. Call once in `beforeAll`.
 */
export function createMigratedDb(): Database.default.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

/**
 * Create a savepoint. Call before each property iteration.
 */
export function savepoint(db: Database.default.Database, name = 'prop_iter'): void {
  db.exec(`SAVEPOINT ${name}`)
}

/**
 * Rollback to savepoint, undoing all changes from the iteration.
 * This is essentially free — no data to delete, no migrations to re-run.
 */
export function rollback(db: Database.default.Database, name = 'prop_iter'): void {
  db.exec(`ROLLBACK TO ${name}`)
  db.exec(`RELEASE ${name}`)
}

/**
 * Create a full test context (all repos + services) backed by a single DB.
 * Use with `savepoint(ctx.db)` / `rollback(ctx.db)` between iterations.
 * Call once in `beforeAll`, close in `afterAll`.
 */
export function createReusableTestContext(): TestContext {
  return createTestContext()
}

export type { TestContext }
