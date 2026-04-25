/**
 * Property tests for step assignment feature.
 *
 * Tests P1 (round-trip), P2 (invalid rejection), P3 (non-existent step error).
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { createPathService } from '../../server/services/pathService'
import { generateId } from '../../server/utils/idGenerator'
import { NotFoundError, ValidationError } from '../../server/utils/errors'

function setupServices(db: Database.Database) {
  const repos = {
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    users: new SQLiteUserRepository(db),
  }
  const pathService = createPathService({ paths: repos.paths, parts: repos.parts, users: repos.users })
  return { repos, pathService }
}

/** Create a job directly in DB (minimal, just enough for FK) */
function insertJob(db: Database.Database, jobId: string) {
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(jobId, `Job-${jobId}`, 10, now, now)
}

/** Create a user directly in DB */
function insertUser(db: Database.Database, userId: string, active: boolean) {
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO users (id, username, display_name, is_admin, department, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(userId, `user-${userId}`, `User-${userId}`, 0, null, active ? 1 : 0, now)
}

/**
 * Property 1: Step assignment round-trip
 *
 * For any ProcessStep and active ShopUser, assigning and reading back returns
 * matching `assignedTo`; assigning null returns undefined.
 *
 * **Validates: Requirements 1.5, 2.1, 2.2, 2.5**
 */
describe('Property 1: Step assignment round-trip', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('assigning a user and reading back returns matching assignedTo; assigning null clears it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.boolean(),
        (stepCount, shouldUnassign) => {
          savepoint(db)
          try {
            const { repos, pathService } = setupServices(db)

            // Create a job and path with steps
            const jobId = generateId('job')
            insertJob(db, jobId)

            const path = repos.paths.create({
              id: generateId('path'),
              jobId,
              name: 'Test Path',
              goalQuantity: 10,
              steps: Array.from({ length: stepCount }, (_, i) => ({
                id: generateId('step'),
                name: `Step ${i}`,
                order: i,
              })),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })

            // Create an active user
            const userId = generateId('user')
            insertUser(db, userId, true)

            // Pick a random step
            const step = path.steps[0]

            // Assign user to step
            const assigned = pathService.assignStep(step.id, userId)
            expect(assigned.assignedTo).toBe(userId)

            // Read back via getStepById
            const readBack = repos.paths.getStepById(step.id)
            expect(readBack).not.toBeNull()
            expect(readBack!.assignedTo).toBe(userId)

            if (shouldUnassign) {
              // Unassign (null)
              const unassigned = pathService.assignStep(step.id, null)
              expect(unassigned.assignedTo).toBeUndefined()

              const readBackNull = repos.paths.getStepById(step.id)
              expect(readBackNull).not.toBeNull()
              expect(readBackNull!.assignedTo).toBeUndefined()
            }
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 2: Invalid assignment rejection
 *
 * For any non-existent or inactive user ID, `assignStep` throws ValidationError;
 * step remains unchanged.
 *
 * **Validates: Requirements 1.2, 1.3, 2.3**
 */
describe('Property 2: Invalid assignment rejection', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('assigning a non-existent or inactive user throws ValidationError and leaves step unchanged', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (useInactiveUser) => {
          savepoint(db)
          try {
            const { repos, pathService } = setupServices(db)

            // Create a job and path with one step
            const jobId = generateId('job')
            insertJob(db, jobId)

            const stepId = generateId('step')
            repos.paths.create({
              id: generateId('path'),
              jobId,
              name: 'Test Path',
              goalQuantity: 10,
              steps: [{ id: stepId, name: 'Step 0', order: 0 }],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })

            // Optionally assign a valid user first so we can verify it stays unchanged
            const validUserId = generateId('user')
            insertUser(db, validUserId, true)
            pathService.assignStep(stepId, validUserId)

            // Now try to assign an invalid user
            let invalidUserId: string
            if (useInactiveUser) {
              // Create an inactive user
              invalidUserId = generateId('user')
              insertUser(db, invalidUserId, false)
            } else {
              // Use a completely non-existent user ID
              invalidUserId = generateId('user')
            }

            expect(() => pathService.assignStep(stepId, invalidUserId)).toThrow(ValidationError)

            // Verify step assignment is unchanged
            const step = repos.paths.getStepById(stepId)
            expect(step).not.toBeNull()
            expect(step!.assignedTo).toBe(validUserId)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 3: Non-existent step assignment error
 *
 * For any non-existent step ID, `assignStep` throws NotFoundError.
 *
 * **Validates: Requirements 2.4**
 */
describe('Property 3: Non-existent step assignment error', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('assigning to a non-existent step throws NotFoundError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5),
        (randomSuffix) => {
          savepoint(db)
          try {
            const { pathService } = setupServices(db)

            const fakeStepId = `step_${randomSuffix}`

            expect(() => pathService.assignStep(fakeStepId, null)).toThrow(NotFoundError)
            expect(() => pathService.assignStep(fakeStepId, 'some_user')).toThrow(NotFoundError)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
