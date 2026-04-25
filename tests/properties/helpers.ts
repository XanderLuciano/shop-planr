/**
 * Shared helpers for property tests.
 *
 * Creates a single migrated in-memory SQLite database and provides
 * a fast `clearData()` function that truncates all data tables between
 * property test iterations — avoiding the cost of re-running 14 migrations
 * per iteration.
 */
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

/** Tables to truncate between property runs (ordered for FK safety) */
const DATA_TABLES = [
  'audit_entries',
  'cert_attachments',
  'part_step_statuses',
  'part_step_overrides',
  'step_notes',
  'parts',
  'process_steps',
  'paths',
  'bom_entries',
  'bom_versions',
  'boms',
  'job_tags',
  'jobs',
  'certs',
  'templates',
  'template_steps',
  'counters',
  'tags',
] as const

/**
 * Create a migrated in-memory database. Call once in `beforeAll`,
 * then use `clearData(db)` between iterations.
 */
export function createMigratedDb(): Database.default.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

/**
 * Fast data reset — deletes all rows from data tables without
 * dropping/recreating them. ~100x faster than re-running migrations.
 */
export function clearData(db: Database.default.Database): void {
  db.pragma('foreign_keys = OFF')
  for (const table of DATA_TABLES) {
    db.prepare(`DELETE FROM ${table}`).run()
  }
  db.pragma('foreign_keys = ON')
}
