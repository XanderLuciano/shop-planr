/**
 * Property 2: List sorted by priority
 *
 * For any set of jobs in the database, listing jobs should return them sorted
 * by priority in ascending order (priority 1 first).
 *
 * **Validates: Requirement 2.1**
 */
import { describe, it, afterEach, expect } from 'vitest'
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

describe('Property 2: List sorted by priority', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('list() returns jobs sorted by priority ascending after creation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (n) => {
          db = createTestDb()
          const { jobService } = setupServices(db)

          // Create N jobs
          for (let i = 0; i < n; i++) {
            jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
          }

          const jobs = jobService.listJobs()
          expect(jobs.length).toBe(n)

          // Verify sorted by priority ascending
          for (let i = 1; i < jobs.length; i++) {
            expect(jobs[i].priority).toBeGreaterThan(jobs[i - 1].priority)
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  it('list() returns jobs sorted by priority ascending after a random reorder via updatePriorities', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.context(),
        (n, ctx) => {
          db = createTestDb()
          const { jobService } = setupServices(db)

          // Create N jobs
          const createdIds: string[] = []
          for (let i = 0; i < n; i++) {
            const job = jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
            createdIds.push(job.id)
          }

          // Generate a random permutation of priorities 1..N
          const indices = Array.from({ length: n }, (_, i) => i)
          // Fisher-Yates shuffle
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]]
          }

          const priorities = createdIds.map((id, idx) => ({
            jobId: id,
            priority: indices[idx] + 1,
          }))

          ctx.log(`Permutation: ${JSON.stringify(priorities.map(p => p.priority))}`)

          // Apply the reorder
          jobService.updatePriorities({ priorities })

          // List and verify sorted ascending
          const jobs = jobService.listJobs()
          expect(jobs.length).toBe(n)

          for (let i = 1; i < jobs.length; i++) {
            expect(jobs[i].priority).toBeGreaterThan(jobs[i - 1].priority)
          }

          // Also verify priorities form contiguous {1..N}
          const priorityValues = jobs.map(j => j.priority)
          const expected = Array.from({ length: n }, (_, i) => i + 1)
          expect(priorityValues).toEqual(expected)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
