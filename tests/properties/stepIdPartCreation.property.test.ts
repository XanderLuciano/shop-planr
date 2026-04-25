/**
 * Feature: step-id-part-tracking
 * Property 1: Part creation sets currentStepId to first step
 *
 * For any path with at least one step, when a Part is created with
 * `currentStepId` set to the first step's ID, reading it back via the
 * repository preserves the value. Also verifies that `currentStepId = null`
 * (completed) round-trips correctly.
 *
 * **Validates: Requirements 1.2**
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import type { Part } from '../../server/types/domain'

/**
 * Seed a job, path, and N process steps. Returns the step IDs in order.
 */
function seedWithSteps(
  db: Database.Database,
  jobId: string,
  pathId: string,
  stepCount: number,
): string[] {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES (?, 'Job', 10, ?, ?)`,
  ).run(jobId, now, now)
  db.prepare(
    `INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at) VALUES (?, ?, 'Path', 10, 'strict', ?, ?)`,
  ).run(pathId, jobId, now, now)

  const stepIds: string[] = []
  for (let i = 0; i < stepCount; i++) {
    const stepId = `step_${pathId}_${i}`
    db.prepare(
      `INSERT INTO process_steps (id, path_id, name, step_order, optional, dependency_type) VALUES (?, ?, ?, ?, 0, 'preferred')`,
    ).run(stepId, pathId, `Step ${i}`, i)
    stepIds.push(stepId)
  }
  return stepIds
}

// ---- Arbitraries ----

const arbId = () => fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)
const arbIsoDate = () =>
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ts => new Date(ts).toISOString())

// ---- Tests ----

describe('Feature: step-id-part-tracking, Property 1: Part creation sets currentStepId to first step', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('creating a part with currentStepId = first step ID round-trips correctly', () => {
    fc.assert(
      fc.property(
        arbId(),
        fc.integer({ min: 1, max: 10 }),
        arbIsoDate(),
        arbIsoDate(),
        (partId, stepCount, createdAt, updatedAt) => {
          savepoint(db)
          try {
            const jobId = `job_${partId}`
            const pathId = `path_${partId}`
            const stepIds = seedWithSteps(db, jobId, pathId, stepCount)
            const repo = new SQLitePartRepository(db)

            const firstStepId = stepIds[0]!
            const part: Part = {
              id: partId,
              jobId,
              pathId,
              currentStepId: firstStepId,
              status: 'in_progress',
              forceCompleted: false,
              createdAt,
              updatedAt,
            }

            repo.create(part)
            const retrieved = repo.getById(partId)

            expect(retrieved).not.toBeNull()
            expect(retrieved!.currentStepId).toBe(firstStepId)
            expect(retrieved!.status).toBe('in_progress')
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('creating a completed part with currentStepId = null round-trips correctly', () => {
    fc.assert(
      fc.property(
        arbId(),
        fc.integer({ min: 1, max: 5 }),
        arbIsoDate(),
        arbIsoDate(),
        (partId, stepCount, createdAt, updatedAt) => {
          savepoint(db)
          try {
            const jobId = `job_c_${partId}`
            const pathId = `path_c_${partId}`
            seedWithSteps(db, jobId, pathId, stepCount)
            const repo = new SQLitePartRepository(db)

            const part: Part = {
              id: partId,
              jobId,
              pathId,
              currentStepId: null,
              status: 'completed',
              forceCompleted: false,
              createdAt,
              updatedAt,
            }

            repo.create(part)
            const retrieved = repo.getById(partId)

            expect(retrieved).not.toBeNull()
            expect(retrieved!.currentStepId).toBeNull()
            expect(retrieved!.status).toBe('completed')
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('creating a part at any valid step preserves the currentStepId', () => {
    fc.assert(
      fc.property(
        arbId(),
        fc.integer({ min: 2, max: 8 }),
        arbIsoDate(),
        arbIsoDate(),
        (partId, stepCount, createdAt, updatedAt) => {
          savepoint(db)
          try {
            const jobId = `job_a_${partId}`
            const pathId = `path_a_${partId}`
            const stepIds = seedWithSteps(db, jobId, pathId, stepCount)
            const repo = new SQLitePartRepository(db)

            // Pick a random step index deterministically from partId
            const stepIndex = partId.length % stepCount
            const chosenStepId = stepIds[stepIndex]!

            const part: Part = {
              id: partId,
              jobId,
              pathId,
              currentStepId: chosenStepId,
              status: 'in_progress',
              forceCompleted: false,
              createdAt,
              updatedAt,
            }

            repo.create(part)
            const retrieved = repo.getById(partId)

            expect(retrieved).not.toBeNull()
            expect(retrieved!.currentStepId).toBe(chosenStepId)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
