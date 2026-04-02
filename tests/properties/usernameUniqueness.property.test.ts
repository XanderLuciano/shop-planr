/**
 * Feature: user-admin-roles
 * Property 2: Username Uniqueness Enforcement
 *
 * For any two user creation inputs sharing the same username (case-sensitive),
 * the second creation should throw a ValidationError. The first user should
 * remain unaffected in the repository.
 *
 * **Validates: Requirements 1.8**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTestDb } from '../integration/helpers'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { createUserService } from '../../server/services/userService'
import { ValidationError } from '../../server/utils/errors'

/**
 * Arbitrary: non-empty trimmed strings suitable for username/displayName.
 * Uses printable ASCII to avoid SQLite encoding edge cases.
 */
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.'.split('')
const arbNonEmptyString = fc.array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 30 })
  .map(chars => chars.join(''))

describe('Property 2: Username Uniqueness Enforcement', () => {
  it('second creation with same username throws ValidationError, first user unaffected', () => {
    let runIndex = 0

    fc.assert(
      fc.property(
        arbNonEmptyString,
        arbNonEmptyString,
        arbNonEmptyString,
        (username, displayName1, displayName2) => {
          const db = createTestDb()
          try {
            const userRepo = new SQLiteUserRepository(db)
            const userService = createUserService({ users: userRepo })

            // Make username unique per run to avoid cross-iteration collisions
            const uniqueUsername = `${username}_${runIndex++}`

            // First creation should succeed
            const firstUser = userService.createUser({
              username: uniqueUsername,
              displayName: displayName1,
            })

            // Second creation with same username should throw ValidationError
            expect(() =>
              userService.createUser({
                username: uniqueUsername,
                displayName: displayName2,
              }),
            ).toThrow(ValidationError)

            // First user should still be retrievable and unaffected
            const retrieved = userService.getUser(firstUser.id)
            expect(retrieved.id).toBe(firstUser.id)
            expect(retrieved.username).toBe(uniqueUsername.trim())
            expect(retrieved.displayName).toBe(displayName1.trim())
            expect(retrieved.active).toBe(true)
            expect(retrieved.isAdmin).toBe(false)
          } finally {
            db.close()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
