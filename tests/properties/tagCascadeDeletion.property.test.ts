/**
 * Property CP-TAG-4: Cascade Deletion Completeness
 *
 * After deleting a tag, getTagsByJobId never returns that tag for any job.
 *
 * **Validates: Requirements 3.2**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteTagRepository } from '../../server/repositories/sqlite/tagRepository'
import { SQLiteJobTagRepository } from '../../server/repositories/sqlite/jobTagRepository'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { createTagService } from '../../server/services/tagService'
import { createJobService } from '../../server/services/jobService'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

describe('Property CP-TAG-4: Cascade Deletion Completeness', () => {
  let db: InstanceType<typeof Database> | null = null

  afterEach(() => {
    if (db) {
      db.close()
      db = null
    }
  })

  it('deleted tag never appears in getTagsByJobId for any job', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (goalQty) => {
          db = createTestDb()
          const tagRepo = new SQLiteTagRepository(db)
          const jobTagRepo = new SQLiteJobTagRepository(db)
          const jobRepo = new SQLiteJobRepository(db)
          const pathRepo = new SQLitePathRepository(db)
          const partRepo = new SQLitePartRepository(db)
          const tagService = createTagService({ tags: tagRepo, jobTags: jobTagRepo })
          const jobService = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo, jobTags: jobTagRepo, tags: tagRepo })

          // Create a job
          const job = jobService.createJob({ name: 'Cascade Test Job', goalQuantity: goalQty })

          // Create 2 tags
          const tagToDelete = tagService.createTag({ name: 'Tag To Delete', color: '#ef4444' })
          const tagToKeep = tagService.createTag({ name: 'Tag To Keep', color: '#3b82f6' })

          // Assign both tags to the job
          jobService.setJobTags(job.id, [tagToDelete.id, tagToKeep.id])

          // Verify both tags are assigned
          const tagsBefore = tagService.getTagsByJobId(job.id)
          expect(tagsBefore.map(t => t.id)).toContain(tagToDelete.id)
          expect(tagsBefore.map(t => t.id)).toContain(tagToKeep.id)

          // Delete one tag
          tagService.deleteTag(tagToDelete.id)

          // Verify the deleted tag no longer appears for the job
          const tagsAfter = tagService.getTagsByJobId(job.id)
          const afterIds = tagsAfter.map(t => t.id)
          expect(afterIds).not.toContain(tagToDelete.id)
          expect(afterIds).toContain(tagToKeep.id)

          db.close()
          db = null
        },
      ),
      { numRuns: 100 },
    )
  })
})
