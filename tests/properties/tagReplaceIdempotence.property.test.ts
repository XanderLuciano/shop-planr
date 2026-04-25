/**
 * Property CP-TAG-3: Replace Idempotence
 *
 * For any jobId and tagIds, calling setJobTags twice with the same inputs
 * produces identical associations.
 *
 * **Validates: Requirements 5.1, 5.3**
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { createJobService } from '../../server/services/jobService'
import { createTagServiceForTest, ADMIN_ID } from './helpers/tagTestHarness'

describe('Property CP-TAG-3: Replace Idempotence', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('calling setJobTags twice with the same tagIds produces identical associations', () => {
    fc.assert(
      fc.property(
        fc.subarray(['tag_a', 'tag_b', 'tag_c']),
        (selectedKeys) => {
          savepoint(db)
          try {
            const { tagService, tagRepo, jobTagRepo, userRepo } = createTagServiceForTest(db)
            const jobRepo = new SQLiteJobRepository(db)
            const pathRepo = new SQLitePathRepository(db)
            const partRepo = new SQLitePartRepository(db)
            const jobService = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo, jobTags: jobTagRepo, tags: tagRepo, users: userRepo })

            // Create 3 tags with fixed IDs by creating them and tracking their real IDs
            const tagA = tagService.createTag(ADMIN_ID, { name: 'Tag Alpha', color: '#ef4444' })
            const tagB = tagService.createTag(ADMIN_ID, { name: 'Tag Beta', color: '#3b82f6' })
            const tagC = tagService.createTag(ADMIN_ID, { name: 'Tag Gamma', color: '#22c55e' })

            const keyToId: Record<string, string> = {
              tag_a: tagA.id,
              tag_b: tagB.id,
              tag_c: tagC.id,
            }

            const tagIds = selectedKeys.map(k => keyToId[k])

            // Create a job
            const job = jobService.createJob({ name: 'Test Job', goalQuantity: 10 })

            // Call setJobTags twice with the same tagIds
            const result1 = jobService.setJobTags(ADMIN_ID, job.id, tagIds)
            const result2 = jobService.setJobTags(ADMIN_ID, job.id, tagIds)

            // Both results should have the same tag IDs (order may differ)
            const ids1 = result1.map(t => t.id).sort()
            const ids2 = result2.map(t => t.id).sort()
            expect(ids1).toEqual(ids2)

            // Also verify via getTagsByJobId
            const tagsAfter1 = tagService.getTagsByJobId(job.id).map(t => t.id).sort()
            const tagsAfter2 = tagService.getTagsByJobId(job.id).map(t => t.id).sort()
            expect(tagsAfter1).toEqual(tagsAfter2)
            expect(tagsAfter1).toEqual(ids1)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
