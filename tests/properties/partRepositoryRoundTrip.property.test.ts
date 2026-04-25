/**
 * Feature: serial-to-part-id-rename
 * Property 3: Repository CRUD Round-Trip on Renamed Tables
 *
 * For any valid Part object, creating it via the PartRepository and then reading
 * it back by ID should return an equivalent object — verifying that all SQL queries
 * correctly reference the renamed `parts` table and columns.
 *
 * **Validates: Requirements 3.5**
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import type { Part, ScrapReason } from '../../server/types/domain'

/**
 * Insert a minimal Job + Path so that foreign key constraints are satisfied
 * when creating Part records. Also inserts process_steps for the FK on current_step_id.
 */
function seedPrerequisites(db: Database.Database, jobId: string, pathId: string, stepIds: string[]) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at)
    VALUES (?, 'Test Job', 10, ?, ?)
  `).run(jobId, now, now)

  db.prepare(`
    INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at)
    VALUES (?, ?, 'Test Path', 10, 'strict', ?, ?)
  `).run(pathId, jobId, now, now)

  // Seed process_steps for FK constraint on current_step_id
  for (let i = 0; i < stepIds.length; i++) {
    db.prepare(`
      INSERT OR IGNORE INTO process_steps (id, path_id, name, step_order, optional, dependency_type, completed_count)
      VALUES (?, ?, ?, ?, 0, 'preferred', 0)
    `).run(stepIds[i], pathId, `Step ${i}`, i)
  }
}

// ---- Arbitraries ----

const arbId = () => fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)
const arbIsoDate = () =>
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ts => new Date(ts).toISOString())

const arbScrapReason = (): fc.Arbitrary<ScrapReason> =>
  fc.constantFrom('out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other')

const STEP_IDS = ['step_a', 'step_b', 'step_c']

const arbPartInProgress = (jobId: string, pathId: string): fc.Arbitrary<Part> =>
  fc.record({
    id: arbId(),
    jobId: fc.constant(jobId),
    pathId: fc.constant(pathId),
    currentStepId: fc.constantFrom(...STEP_IDS),
    status: fc.constant('in_progress' as const),
    forceCompleted: fc.constant(false),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbPartScrapped = (jobId: string, pathId: string): fc.Arbitrary<Part> =>
  fc.record({
    id: arbId(),
    jobId: fc.constant(jobId),
    pathId: fc.constant(pathId),
    currentStepId: fc.constantFrom(...STEP_IDS),
    status: fc.constant('scrapped' as const),
    scrapReason: arbScrapReason(),
    scrapExplanation: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    scrapStepId: fc.option(arbId(), { nil: undefined }),
    scrappedAt: fc.option(arbIsoDate(), { nil: undefined }),
    scrappedBy: fc.option(arbId(), { nil: undefined }),
    forceCompleted: fc.constant(false),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbPartCompleted = (jobId: string, pathId: string): fc.Arbitrary<Part> =>
  fc.record({
    id: arbId(),
    jobId: fc.constant(jobId),
    pathId: fc.constant(pathId),
    currentStepId: fc.constant(null as string | null),
    status: fc.constant('completed' as const),
    forceCompleted: fc.boolean(),
    forceCompletedBy: fc.option(arbId(), { nil: undefined }),
    forceCompletedAt: fc.option(arbIsoDate(), { nil: undefined }),
    forceCompletedReason: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbPart = (jobId: string, pathId: string): fc.Arbitrary<Part> =>
  fc.oneof(
    arbPartInProgress(jobId, pathId),
    arbPartScrapped(jobId, pathId),
    arbPartCompleted(jobId, pathId),
  )

// ---- Helpers ----

/**
 * Normalize a Part for comparison: undefined optional fields become undefined
 * consistently (the repository maps SQL NULLs to undefined).
 */
function normalizePart(part: Part): Part {
  return {
    id: part.id,
    jobId: part.jobId,
    pathId: part.pathId,
    currentStepId: part.currentStepId,
    status: part.status,
    scrapReason: part.scrapReason ?? undefined,
    scrapExplanation: part.scrapExplanation ?? undefined,
    scrapStepId: part.scrapStepId ?? undefined,
    scrappedAt: part.scrappedAt ?? undefined,
    scrappedBy: part.scrappedBy ?? undefined,
    forceCompleted: part.forceCompleted,
    forceCompletedBy: part.forceCompletedBy ?? undefined,
    forceCompletedAt: part.forceCompletedAt ?? undefined,
    forceCompletedReason: part.forceCompletedReason ?? undefined,
    createdAt: part.createdAt,
    updatedAt: part.updatedAt,
  }
}

// ---- Tests ----

describe('Property 3: Repository CRUD Round-Trip on Renamed Tables', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('create then getById returns an equivalent Part object', () => {
    const JOB_ID = 'job_roundtrip'
    const PATH_ID = 'path_roundtrip'

    fc.assert(
      fc.property(arbPart(JOB_ID, PATH_ID), (part) => {
        savepoint(db)
        try {
          seedPrerequisites(db, JOB_ID, PATH_ID, STEP_IDS)
          const repo = new SQLitePartRepository(db)

          repo.create(part)
          const retrieved = repo.getById(part.id)

          expect(retrieved).not.toBeNull()
          expect(normalizePart(retrieved!)).toEqual(normalizePart(part))
        } finally {
          rollback(db)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('create then listByJobId includes the created Part', () => {
    const JOB_ID = 'job_list_rt'
    const PATH_ID = 'path_list_rt'

    fc.assert(
      fc.property(arbPart(JOB_ID, PATH_ID), (part) => {
        savepoint(db)
        try {
          seedPrerequisites(db, JOB_ID, PATH_ID, STEP_IDS)
          const repo = new SQLitePartRepository(db)

          repo.create(part)
          const list = repo.listByJobId(JOB_ID)

          expect(list.length).toBe(1)
          expect(normalizePart(list[0])).toEqual(normalizePart(part))
        } finally {
          rollback(db)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('create then update then getById reflects the update', () => {
    const JOB_ID = 'job_update_rt'
    const PATH_ID = 'path_update_rt'

    fc.assert(
      fc.property(
        arbPartInProgress(JOB_ID, PATH_ID),
        fc.constantFrom(...STEP_IDS),
        arbIsoDate(),
        (part, newStepId, newUpdatedAt) => {
          savepoint(db)
          try {
            seedPrerequisites(db, JOB_ID, PATH_ID, STEP_IDS)
            const repo = new SQLitePartRepository(db)

            repo.create(part)
            const updated = repo.update(part.id, {
              currentStepId: newStepId,
              updatedAt: newUpdatedAt,
            })

            expect(updated.currentStepId).toBe(newStepId)
            expect(updated.updatedAt).toBe(newUpdatedAt)

            const retrieved = repo.getById(part.id)
            expect(retrieved).not.toBeNull()
            expect(retrieved!.currentStepId).toBe(newStepId)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
