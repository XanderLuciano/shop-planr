/**
 * Property CP-TAG-2: Tag Name Length Bound
 *
 * For any string of length > 30 (after trim), createTag throws ValidationError.
 * For any string of length 1-30 (after trim, unique), createTag succeeds.
 *
 * **Validates: Requirements 1.3, 1.4**
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { createTagServiceForTest, ADMIN_ID } from './helpers/tagTestHarness'
import { ValidationError } from '../../server/utils/errors'

describe('Property CP-TAG-2: Tag Name Length Bound', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('createTag throws ValidationError for names longer than 30 characters after trim', () => {
    fc.assert(
      fc.property(
        // Generate strings that are > 30 chars even after trimming
        fc.string({ minLength: 31, maxLength: 100 }).filter(s => s.trim().length > 30),
        (longName) => {
          savepoint(db)
          try {
            const { tagService } = createTagServiceForTest(db)

            expect(() => {
              tagService.createTag(ADMIN_ID, { name: longName })
            }).toThrow(ValidationError)
          } finally {
            rollback(db)
          }
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
          savepoint(db)
          try {
            const { tagService } = createTagServiceForTest(db)

            const tag = tagService.createTag(ADMIN_ID, { name: validName })
            expect(tag.name).toBe(validName.trim())
            expect(tag.name.length).toBeGreaterThanOrEqual(1)
            expect(tag.name.length).toBeLessThanOrEqual(30)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
