/**
 * Property 3: Valid priority update persists correctly
 *
 * For any valid permutation of priorities across all existing jobs, after calling
 * updatePriorities, each job's priority should equal the specified value, the set
 * of priorities should be exactly {1, 2, ..., N}, and no two jobs share a priority.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { createJobService } from '../../server/services/jobService'

function setupServices(db: Database.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
  }
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  return { jobService, repos }
}

describe('Property 3: Valid priority update persists correctly', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('after updatePriorities with a valid permutation, each job has the specified priority and the set is exactly {1..N}', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).chain(n =>
          fc.tuple(
            fc.constant(n),
            fc.shuffledSubarray(Array.from({ length: n }, (_, i) => i + 1), { minLength: n, maxLength: n }),
          ),
        ),
        ([n, permutation]) => {
          savepoint(db)
          try {
            const { jobService } = setupServices(db)

            // Create N jobs
            const createdJobs: { id: string }[] = []
            for (let i = 0; i < n; i++) {
              const job = jobService.createJob({ name: `Job ${i}`, goalQuantity: 10 })
              createdJobs.push({ id: job.id })
            }

            // Build the priority mapping: each job gets a shuffled priority
            const priorities = createdJobs.map((job, idx) => ({
              jobId: job.id,
              priority: permutation[idx],
            }))

            // Apply the update
            const updatedJobs = jobService.updatePriorities({ priorities })

            // 1. Each job has the specified priority
            for (const entry of priorities) {
              const job = updatedJobs.find(j => j.id === entry.jobId)
              expect(job).toBeDefined()
              expect(job!.priority).toBe(entry.priority)
            }

            // 2. The set of priorities is exactly {1..N}
            const actualPriorities = updatedJobs.map(j => j.priority).sort((a, b) => a - b)
            const expectedPriorities = Array.from({ length: n }, (_, i) => i + 1)
            expect(actualPriorities).toEqual(expectedPriorities)

            // 3. No two jobs share a priority (uniqueness)
            const prioritySet = new Set(updatedJobs.map(j => j.priority))
            expect(prioritySet.size).toBe(n)

            // 4. Re-reading from DB confirms persistence
            const reloadedJobs = jobService.listJobs()
            for (const entry of priorities) {
              const job = reloadedJobs.find(j => j.id === entry.jobId)
              expect(job).toBeDefined()
              expect(job!.priority).toBe(entry.priority)
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
