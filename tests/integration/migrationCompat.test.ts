/**
 * Integration: Migration Backwards Compatibility
 *
 * Verify existing data with old schema gets correct defaults after migration:
 * - serials with currentStepId = null → status = 'completed'
 * - steps → optional = false, dependencyType = 'preferred'
 * - paths → advancementMode = 'strict'
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */
import { describe, it, afterEach, expect } from 'vitest'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { readdirSync, readFileSync } from 'fs'

describe('Migration Backwards Compatibility Integration', () => {
  let db: Database.Database

  afterEach(() => db?.close())

  /**
   * Runs only migrations up to (but not including) 004, inserts "old schema" data,
   * then runs migration 004 and verifies defaults are applied correctly.
   */
  it('existing data gets correct defaults after migration 004', () => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')

    // Create the _migrations tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        checksum TEXT NOT NULL
      )
    `)

    // Load and sort migration files
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    // Run migrations 001-003 only (pre-lifecycle)
    for (const filename of files) {
      const match = filename.match(/^(\d+)_(.+)\.sql$/)
      if (!match) continue
      const version = parseInt(match[1]!, 10)
      if (version >= 4) continue // stop before 004

      const sql = readFileSync(resolve(migrationsDir, filename), 'utf-8')
      db.transaction(() => {
        db.exec(sql)
        db.prepare(
          'INSERT INTO _migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)',
        ).run(version, match[2], new Date().toISOString(), 'test')
      })()
    }

    // Insert "old schema" data — a job, path with steps, and serials
    const now = new Date().toISOString()

    db.prepare(`INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run('job_old', 'Old Job', 10, now, now)

    db.prepare(`INSERT INTO paths (id, job_id, name, goal_quantity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run('path_old', 'job_old', 'Old Path', 10, now, now)

    db.prepare(`INSERT INTO process_steps (id, path_id, name, step_order)
      VALUES (?, ?, ?, ?)`).run('step_old_1', 'path_old', 'Step A', 0)
    db.prepare(`INSERT INTO process_steps (id, path_id, name, step_order)
      VALUES (?, ?, ?, ?)`).run('step_old_2', 'path_old', 'Step B', 1)

    // Create an in-progress serial (step 0)
    db.prepare(`INSERT INTO serials (id, job_id, path_id, current_step_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run('sn_ip', 'job_old', 'path_old', 0, now, now)

    // Create a completed serial (step -1)
    db.prepare(`INSERT INTO serials (id, job_id, path_id, current_step_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run('sn_done', 'job_old', 'path_old', -1, now, now)

    // Now run migration 004
    const migration004File = files.find(f => f.startsWith('004'))
    expect(migration004File).toBeDefined()

    const migration004Sql = readFileSync(resolve(migrationsDir, migration004File!), 'utf-8')
    db.transaction(() => {
      db.exec(migration004Sql)
      db.prepare(
        'INSERT INTO _migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)',
      ).run(4, 'lifecycle_management', new Date().toISOString(), 'test')
    })()

    // Verify: completed serial has status = 'completed'
    const completedSerial = db.prepare('SELECT status FROM serials WHERE id = ?').get('sn_done') as { status: string }
    expect(completedSerial.status).toBe('completed')

    // Verify: in-progress serial has status = 'in_progress' (default)
    const ipSerial = db.prepare('SELECT status FROM serials WHERE id = ?').get('sn_ip') as { status: string }
    expect(ipSerial.status).toBe('in_progress')

    // Verify: process steps have optional = 0 (false) and dependency_type = 'preferred'
    const steps = db.prepare('SELECT optional, dependency_type FROM process_steps WHERE path_id = ?').all('path_old') as { optional: number, dependency_type: string }[]
    for (const step of steps) {
      expect(step.optional).toBe(0)
      expect(step.dependency_type).toBe('preferred')
    }

    // Verify: path has advancement_mode = 'strict'
    const pathRow = db.prepare('SELECT advancement_mode FROM paths WHERE id = ?').get('path_old') as { advancement_mode: string }
    expect(pathRow.advancement_mode).toBe('strict')

    // Verify: new tables exist
    const tables = db.prepare(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name IN (\'sn_step_statuses\', \'sn_step_overrides\', \'bom_versions\', \'process_library\', \'location_library\')',
    ).all() as { name: string }[]
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('sn_step_statuses')
    expect(tableNames).toContain('sn_step_overrides')
    expect(tableNames).toContain('bom_versions')
    expect(tableNames).toContain('process_library')
    expect(tableNames).toContain('location_library')

    // Verify: seed data in process_library
    const processCount = db.prepare('SELECT COUNT(*) as cnt FROM process_library').get() as { cnt: number }
    expect(processCount.cnt).toBeGreaterThanOrEqual(8)

    // Verify: seed data in location_library
    const locationCount = db.prepare('SELECT COUNT(*) as cnt FROM location_library').get() as { cnt: number }
    expect(locationCount.cnt).toBeGreaterThanOrEqual(3)
  })
})
