/**
 * Feature: user-admin-roles
 * Property 1: User CRUD Round-Trip
 *
 * For any valid username (non-empty, unique) and displayName (non-empty), and any
 * boolean isAdmin value, creating a user with those fields and then reading it back
 * by ID should return a user with identical `username`, `displayName`, `isAdmin`,
 * `department`, and `active` fields. When `isAdmin` is omitted from the creation
 * input, the read-back user should have `isAdmin === false`.
 *
 * **Validates: Requirements 1.7, 2.3, 2.4, 8.6**
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { createUserService } from '../../server/services/userService'

/**
 * Arbitrary: non-empty trimmed strings suitable for username/displayName.
 * Uses printable ASCII to avoid SQLite encoding edge cases.
 */
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.'.split('')
const arbNonEmptyString = fc.array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 30 })
  .map(chars => chars.join(''))

describe('Property 1: User CRUD Round-Trip', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('create user with explicit isAdmin and read back — all fields match', () => {
    let runIndex = 0

    fc.assert(
      fc.property(
        arbNonEmptyString,
        arbNonEmptyString,
        fc.boolean(),
        fc.option(arbNonEmptyString, { nil: undefined }),
        (username, displayName, isAdmin, department) => {
          savepoint(db)
          try {
            const userRepo = new SQLiteUserRepository(db)
            const userService = createUserService({ users: userRepo })

            // Make username unique per run to avoid cross-iteration collisions
            const uniqueUsername = `${username}_${runIndex++}`

            const created = userService.createUser({
              username: uniqueUsername,
              displayName,
              isAdmin,
              department,
            })

            // Read back by ID
            const readBack = userService.getUser(created.id)

            // All fields must match
            expect(readBack.username).toBe(uniqueUsername.trim())
            expect(readBack.displayName).toBe(displayName.trim())
            expect(readBack.isAdmin).toBe(isAdmin)
            expect(readBack.department).toBe(department)
            expect(readBack.active).toBe(true)
            expect(readBack.id).toBe(created.id)
            expect(readBack.createdAt).toBe(created.createdAt)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('create user with isAdmin omitted — defaults to false', () => {
    let runIndex = 0

    fc.assert(
      fc.property(
        arbNonEmptyString,
        arbNonEmptyString,
        fc.option(arbNonEmptyString, { nil: undefined }),
        (username, displayName, department) => {
          savepoint(db)
          try {
            const userRepo = new SQLiteUserRepository(db)
            const userService = createUserService({ users: userRepo })

            const uniqueUsername = `${username}_default_${runIndex++}`

            const created = userService.createUser({
              username: uniqueUsername,
              displayName,
              department,
              // isAdmin intentionally omitted
            })

            // Read back by ID
            const readBack = userService.getUser(created.id)

            // isAdmin must default to false
            expect(readBack.isAdmin).toBe(false)

            // Other fields still match
            expect(readBack.username).toBe(uniqueUsername.trim())
            expect(readBack.displayName).toBe(displayName.trim())
            expect(readBack.department).toBe(department)
            expect(readBack.active).toBe(true)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
