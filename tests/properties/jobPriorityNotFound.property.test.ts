/**
 * Property 5: Non-existent job ID rejection
 *
 * For any priority list that references a job ID not present in the database,
 * the Job_Service should reject the request with a not-found error and leave
 * all job priorities unchanged.
 *
 * **Validates: Requirement 3.6**
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { createJobService } from '../../server/services/jobService'
import { NotFoundError } from '../../server/utils/errors'

function setupServices(db: Database.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
  }
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  return { jobService, repos }
}

describe('Property 5: Non-existent job ID rejection', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('a priority list with a non-existent job ID is rejected and all priorities remain unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        fc.integer({ min: 0 }), // index offset to pick which job ID to replace
        fc.uuid(), // fake non-existent job ID
        (n, indexOffset, fakeId) => {
          savepoint(db)
          try {
            const { jobService } = setupServices(db)

            // Create N jobs
            const createdJobs: { id: string, priority: number }[] = []
            for (let i = 0; i < n; i++) {
              const job = jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
              createdJobs.push({ id: job.id, priority: job.priority })
            }

            // Snapshot priorities before the invalid attempt
            const beforeJobs = jobService.listJobs()
            const beforePriorities = new Map(beforeJobs.map(j => [j.id, j.priority]))

            // Pick one real job to replace with the fake ID
            const replaceIndex = indexOffset % n

            // Build a valid-shaped priority list but replace one real ID with a fake one
            const priorities = createdJobs.map((job, idx) => ({
              jobId: job.id,
              priority: idx + 1,
            }))
            priorities[replaceIndex] = { jobId: fakeId, priority: replaceIndex + 1 }

            // Should throw NotFoundError
            expect(() => jobService.updatePriorities({ priorities })).toThrow(NotFoundError)

            // All priorities remain unchanged
            const afterJobs = jobService.listJobs()
            for (const job of afterJobs) {
              expect(job.priority).toBe(beforePriorities.get(job.id))
            }
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
