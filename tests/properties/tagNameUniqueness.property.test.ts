/**
 * Property CP-TAG-1: Tag Name Uniqueness
 *
 * For any sequence of distinct names (case-insensitive), all createTag calls succeed.
 * For any duplicate name (same name, different case), createTag throws ValidationError.
 *
 * **Validates: Requirements 1.5, 2.2**
 */
import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteTagRepository } from '../../server/repositories/sqlite/tagRepository'
import { SQLiteJobTagRepository } from '../../server/repositories/sqlite/jobTagRepository'
import { createTagService } from '../../server/services/tagService'
import { ValidationError } from '../../server/utils/errors'
import { expect } from 'vitest'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

describe('Property CP-TAG-1: Tag Name Uniqueness', () => {
  let db: InstanceType<typeof Database> | null = null

  afterEach(() => {
    if (db) {
      db.close()
      db = null
    }
  })

  it('all createTag calls succeed when names are distinct (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0 && s.trim().length <= 30),
          { minLength: 2, maxLength: 5 },
        ),
        (distinctNames) => {
          db = createTestDb()
          const tagRepo = new SQLiteTagRepository(db)
          const jobTagRepo = new SQLiteJobTagRepository(db)
          const tagService = createTagService({ tags: tagRepo, jobTags: jobTagRepo })

          // All distinct names should succeed
          for (const name of distinctNames) {
            const tag = tagService.createTag({ name })
            expect(tag.name).toBe(name.trim())
          }

          // All tags should be in the list
          const allTags = tagService.listTags()
          expect(allTags.length).toBe(distinctNames.length)

          db.close()
          db = null
        },
      ),
      { numRuns: 100 },
    )
  })

  it('createTag throws ValidationError when name duplicates an existing tag (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0 && s.trim().length <= 30),
          { minLength: 2, maxLength: 5 },
        ),
        (distinctNames) => {
          db = createTestDb()
          const tagRepo = new SQLiteTagRepository(db)
          const jobTagRepo = new SQLiteJobTagRepository(db)
          const tagService = createTagService({ tags: tagRepo, jobTags: jobTagRepo })

          // Create all tags with distinct names
          for (const name of distinctNames) {
            tagService.createTag({ name })
          }

          // Attempt to create a tag with the same name (lowercased) as the first tag
          const duplicateName = distinctNames[0].trim().toLowerCase()
          expect(() => {
            tagService.createTag({ name: duplicateName })
          }).toThrow(ValidationError)

          db.close()
          db = null
        },
      ),
      { numRuns: 100 },
    )
  })
})
