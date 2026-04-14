/**
 * Property CP-TAG-2: Tag Name Length Bound
 *
 * For any string of length > 30 (after trim), createTag throws ValidationError.
 * For any string of length 1-30 (after trim, unique), createTag succeeds.
 *
 * **Validates: Requirements 1.3, 1.4**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteTagRepository } from '../../server/repositories/sqlite/tagRepository'
import { SQLiteJobTagRepository } from '../../server/repositories/sqlite/jobTagRepository'
import { createTagService } from '../../server/services/tagService'
import { ValidationError } from '../../server/utils/errors'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

describe('Property CP-TAG-2: Tag Name Length Bound', () => {
  let db: InstanceType<typeof Database> | null = null

  afterEach(() => {
    if (db) {
      db.close()
      db = null
    }
  })

  it('createTag throws ValidationError for names longer than 30 characters after trim', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 31, maxLength: 100 }),
        (longName) => {
          db = createTestDb()
          const tagRepo = new SQLiteTagRepository(db)
          const jobTagRepo = new SQLiteJobTagRepository(db)
          const tagService = createTagService({ tags: tagRepo, jobTags: jobTagRepo })

          expect(() => {
            tagService.createTag({ name: longName })
          }).toThrow(ValidationError)

          db.close()
          db = null
        },
      ),
      { numRuns: 100 },
    )
  })

  it('createTag succeeds for names of length 1-30 after trim (unique)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length >= 1 && s.trim().length <= 30),
        (validName) => {
          db = createTestDb()
          const tagRepo = new SQLiteTagRepository(db)
          const jobTagRepo = new SQLiteJobTagRepository(db)
          const tagService = createTagService({ tags: tagRepo, jobTags: jobTagRepo })

          const tag = tagService.createTag({ name: validName })
          expect(tag.name).toBe(validName.trim())
          expect(tag.name.length).toBeGreaterThanOrEqual(1)
          expect(tag.name.length).toBeLessThanOrEqual(30)

          db.close()
          db = null
        },
      ),
      { numRuns: 100 },
    )
  })
})
