/**
 * Property 1: New job priority assignment
 *
 * For any N existing jobs (including zero), creating a new job assigns priority N+1,
 * preserving the contiguous set {1, 2, ..., N+1}.
 *
 * **Validates: Requirements 1.3, 1.4**
 */
import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { createJobService } from '../../server/services/jobService'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

function setupServices(db: Database.default.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
  }
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  return { jobService, repos }
}

describe('Property 1: New job priority assignment', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('creating a new job after N existing jobs assigns priority N+1 and preserves contiguous {1..N+1}', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (n) => {
          db = createTestDb()
          const { jobService } = setupServices(db)

          // Create N existing jobs
          for (let i = 0; i < n; i++) {
            jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
          }

          // Create one more job
          const newJob = jobService.createJob({ name: 'New Job', goalQuantity: 10 })

          // The new job should have priority N+1
          expect(newJob.priority).toBe(n + 1)

          // All jobs should form contiguous set {1..N+1}
          const allJobs = jobService.listJobs()
          expect(allJobs.length).toBe(n + 1)

          const priorities = allJobs.map(j => j.priority).sort((a, b) => a - b)
          const expected = Array.from({ length: n + 1 }, (_, i) => i + 1)
          expect(priorities).toEqual(expected)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
