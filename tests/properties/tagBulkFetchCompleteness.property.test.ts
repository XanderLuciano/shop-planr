/**
 * Property CP-TAG-5: Bulk Fetch Completeness
 *
 * For any set of jobs with known tag assignments, getTagsForJobs returns
 * exactly the expected tags per job — no tags are lost or added.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
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
import { createTagServiceForTest, ADMIN_ID } from './helpers/tagTestHarness'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

describe('Property CP-TAG-5: Bulk Fetch Completeness', () => {
  let db: InstanceType<typeof Database> | null = null

  afterEach(() => {
    if (db) {
      db.close()
      db = null
    }
  })

  it('getTagsForJobs returns exactly the expected tags per job', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.subarray([0, 1, 2], { minLength: 0, maxLength: 3 }), { minLength: 1, maxLength: 5 }),
        (jobCount, tagCount, assignmentPattern) => {
          db = createTestDb()
          const { tagService, tagRepo, jobTagRepo } = createTagServiceForTest(db)
          const jobRepo = new SQLiteJobRepository(db)
          const pathRepo = new SQLitePathRepository(db)
          const partRepo = new SQLitePartRepository(db)
          const jobService = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo, jobTags: jobTagRepo, tags: tagRepo })

          // Create N jobs
          const jobs = Array.from({ length: jobCount }, (_, i) =>
            jobService.createJob({ name: `Job ${i + 1}`, goalQuantity: 5 }),
          )

          // Create M tags (up to tagCount, capped at 3 for index safety)
          const actualTagCount = Math.min(tagCount, 3)
          const tagNames = ['Alpha', 'Beta', 'Gamma']
          const tags = Array.from({ length: actualTagCount }, (_, i) =>
            tagService.createTag(ADMIN_ID, { name: tagNames[i], color: '#8b5cf6' }),
          )

          // Build expected assignments: for each job, assign a subset of tags
          // Use the assignmentPattern array (one entry per job, cycling if needed)
          const expectedAssignments = new Map<string, string[]>()

          for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i]
            const pattern = assignmentPattern[i % assignmentPattern.length] ?? []
            // Filter indices to valid tag indices
            const tagIndices = pattern.filter(idx => idx < actualTagCount)
            const tagIds = [...new Set(tagIndices)].map(idx => tags[idx].id)
            jobService.setJobTags(job.id, tagIds)
            expectedAssignments.set(job.id, tagIds.sort())
          }

          // Fetch all jobs' tags in bulk
          const jobIds = jobs.map(j => j.id)
          const bulkResult = jobTagRepo.getTagsForJobs(jobIds)

          // Verify each job has exactly the expected tags
          for (const job of jobs) {
            const expected = expectedAssignments.get(job.id) ?? []
            const actual = (bulkResult.get(job.id) ?? []).map(t => t.id).sort()
            expect(actual).toEqual(expected)
          }

          db.close()
          db = null
        },
      ),
      { numRuns: 100 },
    )
  })
})
