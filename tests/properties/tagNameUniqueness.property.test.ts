/**
 * Property CP-TAG-1: Tag Name Uniqueness
 *
 * For any sequence of distinct names (case-insensitive), all createTag calls succeed.
 * For any duplicate name (same name, different case), createTag throws ValidationError.
 *
 * **Validates: Requirements 1.5, 2.2**
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { createTagServiceForTest, ADMIN_ID } from './helpers/tagTestHarness'
import { ValidationError } from '../../server/utils/errors'

describe('Property CP-TAG-1: Tag Name Uniqueness', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('all createTag calls succeed when names are distinct (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0 && s.trim().length <= 30),
          {
            minLength: 2,
            maxLength: 5,
            comparator: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase(),
          },
        ),
        (distinctNames) => {
          savepoint(db)
          try {
            const { tagService } = createTagServiceForTest(db)

            // All distinct names should succeed
            for (const name of distinctNames) {
              const tag = tagService.createTag(ADMIN_ID, { name })
              expect(tag.name).toBe(name.trim())
            }

            // All tags should be in the list
            const allTags = tagService.listTags()
            expect(allTags.length).toBe(distinctNames.length)
          } finally {
            rollback(db)
          }
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
          {
            minLength: 2,
            maxLength: 5,
            comparator: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase(),
          },
        ),
        (distinctNames) => {
          savepoint(db)
          try {
            const { tagService } = createTagServiceForTest(db)

            // Create all tags with distinct names
            for (const name of distinctNames) {
              tagService.createTag(ADMIN_ID, { name })
            }

            // Attempt to create a tag with the same name (lowercased) as the first tag
            const duplicateName = distinctNames[0].trim().toLowerCase()
            expect(() => {
              tagService.createTag(ADMIN_ID, { name: duplicateName })
            }).toThrow(ValidationError)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
