/**
 * Feature: user-admin-roles
 * Property 3: Empty/Whitespace Input Rejection
 *
 * For any string composed entirely of whitespace characters (including the empty string),
 * attempting to create a user with that string as `username` should throw a ValidationError,
 * and attempting to create a user with that string as `displayName` should throw a
 * ValidationError. The repository should remain unchanged after the rejected call.
 *
 * **Validates: Requirements 1.7, 3.4, 3.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTestDb } from '../integration/helpers'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { createUserService } from '../../server/services/userService'
import { ValidationError } from '../../server/utils/errors'

/**
 * Arbitrary: whitespace-only strings (spaces, tabs, newlines, carriage returns)
 * including the empty string.
 */
const arbWhitespaceString = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 20 })
  .map(chars => chars.join(''))

/** Valid non-empty string for the "good" field when testing the other field. */
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.'.split('')
const arbNonEmptyString = fc.array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 30 })
  .map(chars => chars.join(''))

let runIndex = 0

describe('Property 3: Empty/Whitespace Input Rejection', () => {
  it('whitespace-only username throws ValidationError, repo unchanged', () => {
    fc.assert(
      fc.property(
        arbWhitespaceString,
        arbNonEmptyString,
        (whitespaceUsername, validDisplayName) => {
          const db = createTestDb()
          try {
            const userRepo = new SQLiteUserRepository(db)
            const userService = createUserService({ users: userRepo })

            expect(() =>
              userService.createUser({
                username: whitespaceUsername,
                displayName: validDisplayName,
              }),
            ).toThrow(ValidationError)

            // Repository should remain empty
            const allUsers = userService.listUsers()
            expect(allUsers).toHaveLength(0)
          } finally {
            db.close()
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('whitespace-only displayName throws ValidationError, repo unchanged', () => {
    fc.assert(
      fc.property(
        arbNonEmptyString,
        arbWhitespaceString,
        (validUsername, whitespaceDisplayName) => {
          const db = createTestDb()
          try {
            const userRepo = new SQLiteUserRepository(db)
            const userService = createUserService({ users: userRepo })

            const uniqueUsername = `${validUsername}_${runIndex++}`

            expect(() =>
              userService.createUser({
                username: uniqueUsername,
                displayName: whitespaceDisplayName,
              }),
            ).toThrow(ValidationError)

            // Repository should remain empty
            const allUsers = userService.listUsers()
            expect(allUsers).toHaveLength(0)
          } finally {
            db.close()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
