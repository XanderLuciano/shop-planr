/**
 * Property 4: Invalid priority list rejection
 *
 * For any priority list that contains duplicate job IDs, duplicate priority values,
 * or priorities that do not form a contiguous sequence from 1 to N, the Job_Service
 * should reject the request with a validation error and leave all job priorities unchanged.
 *
 * **Validates: Requirements 3.3, 3.4, 3.5**
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
import { ValidationError } from '../../server/utils/errors'

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

describe('Property 4: Invalid priority list rejection', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('duplicate job IDs are rejected and all priorities remain unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        (n) => {
          db = createTestDb()
          const { jobService } = setupServices(db)

          // Create N jobs
          const createdJobs: { id: string; priority: number }[] = []
          for (let i = 0; i < n; i++) {
            const job = jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
            createdJobs.push({ id: job.id, priority: job.priority })
          }

          // Snapshot priorities before the invalid attempt
          const beforeJobs = jobService.listJobs()
          const beforePriorities = new Map(beforeJobs.map(j => [j.id, j.priority]))

          // Build a priority list where the first job's ID replaces the second job's ID (duplicate ID)
          const priorities = createdJobs.map((job, idx) => ({
            jobId: job.id,
            priority: idx + 1,
          }))
          // Replace the second entry's jobId with the first entry's jobId → duplicate ID
          priorities[1] = { jobId: createdJobs[0].id, priority: 2 }

          // Should throw ValidationError
          expect(() => jobService.updatePriorities({ priorities })).toThrow(ValidationError)

          // All priorities remain unchanged
          const afterJobs = jobService.listJobs()
          for (const job of afterJobs) {
            expect(job.priority).toBe(beforePriorities.get(job.id))
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  it('duplicate priority values are rejected and all priorities remain unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        (n) => {
          db = createTestDb()
          const { jobService } = setupServices(db)

          // Create N jobs
          const createdJobs: { id: string; priority: number }[] = []
          for (let i = 0; i < n; i++) {
            const job = jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
            createdJobs.push({ id: job.id, priority: job.priority })
          }

          // Snapshot priorities before the invalid attempt
          const beforeJobs = jobService.listJobs()
          const beforePriorities = new Map(beforeJobs.map(j => [j.id, j.priority]))

          // Build a priority list where two entries share the same priority value
          const priorities = createdJobs.map((job, idx) => ({
            jobId: job.id,
            priority: idx + 1,
          }))
          // Give the second entry the same priority as the first → duplicate priority
          priorities[1] = { jobId: createdJobs[1].id, priority: 1 }

          // Should throw ValidationError
          expect(() => jobService.updatePriorities({ priorities })).toThrow(ValidationError)

          // All priorities remain unchanged
          const afterJobs = jobService.listJobs()
          for (const job of afterJobs) {
            expect(job.priority).toBe(beforePriorities.get(job.id))
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  it('non-contiguous priorities are rejected and all priorities remain unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        (n) => {
          db = createTestDb()
          const { jobService } = setupServices(db)

          // Create N jobs
          const createdJobs: { id: string; priority: number }[] = []
          for (let i = 0; i < n; i++) {
            const job = jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
            createdJobs.push({ id: job.id, priority: job.priority })
          }

          // Snapshot priorities before the invalid attempt
          const beforeJobs = jobService.listJobs()
          const beforePriorities = new Map(beforeJobs.map(j => [j.id, j.priority]))

          // Build a priority list with a gap: use priorities 1..N-1 then N+1 (skip N)
          const priorities = createdJobs.map((job, idx) => ({
            jobId: job.id,
            priority: idx + 1,
          }))
          // Replace the last entry's priority with N+1 → creates a gap
          priorities[n - 1] = { jobId: createdJobs[n - 1].id, priority: n + 1 }

          // Should throw ValidationError
          expect(() => jobService.updatePriorities({ priorities })).toThrow(ValidationError)

          // All priorities remain unchanged
          const afterJobs = jobService.listJobs()
          for (const job of afterJobs) {
            expect(job.priority).toBe(beforePriorities.get(job.id))
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
