/**
 * Feature: step-id-part-tracking
 * Property 5: Query by currentStepId returns correct parts
 *
 * For any step ID and set of parts on a path, `listByCurrentStepId(stepId)`
 * shall return exactly the set of non-scrapped parts whose `currentStepId`
 * equals that step ID, and no others.
 *
 * **Validates: Requirements 1.5, 9.1, 9.2**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import type { Part, ScrapReason } from '../../server/types/domain'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

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
    `INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES (?, 'Job', 100, ?, ?)`,
  ).run(jobId, now, now)
  db.prepare(
    `INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at) VALUES (?, ?, 'Path', 100, 'strict', ?, ?)`,
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

const arbIsoDate = () =>
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ts => new Date(ts).toISOString())

const SCRAP_REASONS: ScrapReason[] = ['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other']

/**
 * Generates a list of part assignments: each part gets a step index (or null for completed)
 * and a status. This lets us create parts distributed across steps with various statuses.
 */
interface PartAssignment {
  /** Index into the stepIds array, or -1 for completed (null currentStepId) */
  stepIdx: number
  status: 'in_progress' | 'completed' | 'scrapped'
}

function arbPartAssignments(stepCount: number): fc.Arbitrary<PartAssignment[]> {
  const arbSingleAssignment = fc.record({
    // -1 means completed (currentStepId = null)
    stepIdx: fc.integer({ min: -1, max: stepCount - 1 }),
    status: fc.constantFrom<'in_progress' | 'completed' | 'scrapped'>('in_progress', 'completed', 'scrapped'),
  }).filter(a => {
    // completed parts must have stepIdx = -1 (null currentStepId)
    if (a.status === 'completed') return a.stepIdx === -1
    // in_progress parts must be at a real step
    if (a.status === 'in_progress') return a.stepIdx >= 0
    // scrapped parts can be at any step (they were scrapped while at that step)
    return a.stepIdx >= 0
  })

  return fc.array(arbSingleAssignment, { minLength: 1, maxLength: 15 })
}

// ---- Tests ----

describe('Feature: step-id-part-tracking, Property 5: Query by currentStepId returns correct parts', () => {
  let db: Database.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('listByCurrentStepId returns exactly the non-scrapped parts at the queried step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }).chain(stepCount =>
          fc.tuple(fc.constant(stepCount), arbPartAssignments(stepCount)),
        ),
        ([stepCount, assignments]) => {
          db = createTestDb()
          const jobId = 'job_q'
          const pathId = 'path_q'
          const stepIds = seedWithSteps(db, jobId, pathId, stepCount)
          const repo = new SQLitePartRepository(db)

          const now = new Date().toISOString()

          // Create all parts
          const parts: Part[] = assignments.map((a, i) => ({
            id: `part_${i}`,
            jobId,
            pathId,
            currentStepId: a.stepIdx >= 0 ? stepIds[a.stepIdx]! : null,
            status: a.status,
            forceCompleted: false,
            scrapReason: a.status === 'scrapped' ? 'damaged' as ScrapReason : undefined,
            createdAt: now,
            updatedAt: now,
          }))

          repo.createBatch(parts)

          // For each step, verify listByCurrentStepId returns the correct subset
          for (let s = 0; s < stepCount; s++) {
            const stepId = stepIds[s]!
            const result = repo.listByCurrentStepId(stepId)
            const resultIds = new Set(result.map(p => p.id))

            // Expected: non-scrapped parts whose currentStepId matches
            const expectedIds = new Set(
              parts
                .filter(p => p.currentStepId === stepId && p.status !== 'scrapped')
                .map(p => p.id),
            )

            expect(resultIds).toEqual(expectedIds)

            // Double-check: no scrapped parts in result
            for (const p of result) {
              expect(p.status).not.toBe('scrapped')
            }
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('listByCurrentStepId returns empty for a step with no parts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (stepCount, partCount) => {
          db = createTestDb()
          const jobId = 'job_e'
          const pathId = 'path_e'
          const stepIds = seedWithSteps(db, jobId, pathId, stepCount)
          const repo = new SQLitePartRepository(db)

          const now = new Date().toISOString()

          // Put all parts at step 0
          const parts: Part[] = Array.from({ length: partCount }, (_, i) => ({
            id: `part_e_${i}`,
            jobId,
            pathId,
            currentStepId: stepIds[0]!,
            status: 'in_progress' as const,
            forceCompleted: false,
            createdAt: now,
            updatedAt: now,
          }))

          repo.createBatch(parts)

          // Steps 1..N should return empty
          for (let s = 1; s < stepCount; s++) {
            const result = repo.listByCurrentStepId(stepIds[s]!)
            expect(result).toHaveLength(0)
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('listByCurrentStepId does not leak parts across different paths', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        (countA, countB) => {
          db = createTestDb()
          const now = new Date().toISOString()

          // Create two separate jobs + paths, each with one step
          db.prepare(
            `INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES ('jobA', 'Job A', 10, ?, ?)`,
          ).run(now, now)
          db.prepare(
            `INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES ('jobB', 'Job B', 10, ?, ?)`,
          ).run(now, now)
          db.prepare(
            `INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at) VALUES ('pathA', 'jobA', 'Path A', 10, 'strict', ?, ?)`,
          ).run(now, now)
          db.prepare(
            `INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at) VALUES ('pathB', 'jobB', 'Path B', 10, 'strict', ?, ?)`,
          ).run(now, now)
          db.prepare(
            `INSERT INTO process_steps (id, path_id, name, step_order, optional, dependency_type) VALUES ('stepA', 'pathA', 'Step A', 0, 0, 'preferred')`,
          ).run()
          db.prepare(
            `INSERT INTO process_steps (id, path_id, name, step_order, optional, dependency_type) VALUES ('stepB', 'pathB', 'Step B', 0, 0, 'preferred')`,
          ).run()

          const repo = new SQLitePartRepository(db)

          // Create parts on path A
          const partsA: Part[] = Array.from({ length: countA }, (_, i) => ({
            id: `pA_${i}`,
            jobId: 'jobA',
            pathId: 'pathA',
            currentStepId: 'stepA',
            status: 'in_progress' as const,
            forceCompleted: false,
            createdAt: now,
            updatedAt: now,
          }))
          repo.createBatch(partsA)

          // Create parts on path B
          const partsB: Part[] = Array.from({ length: countB }, (_, i) => ({
            id: `pB_${i}`,
            jobId: 'jobB',
            pathId: 'pathB',
            currentStepId: 'stepB',
            status: 'in_progress' as const,
            forceCompleted: false,
            createdAt: now,
            updatedAt: now,
          }))
          repo.createBatch(partsB)

          // Query stepA — should only return path A parts
          const resultA = repo.listByCurrentStepId('stepA')
          expect(resultA).toHaveLength(countA)
          for (const p of resultA) {
            expect(p.pathId).toBe('pathA')
          }

          // Query stepB — should only return path B parts
          const resultB = repo.listByCurrentStepId('stepB')
          expect(resultB).toHaveLength(countB)
          for (const p of resultB) {
            expect(p.pathId).toBe('pathB')
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
