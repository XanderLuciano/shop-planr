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
 * Insert a minimal Job + Path so that foreign key constraints are satisfied
 * when creating Part records.
 */
function seedPrerequisites(db: Database.Database, jobId: string, pathId: string) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at)
    VALUES (?, 'Test Job', 10, ?, ?)
  `).run(jobId, now, now)

  db.prepare(`
    INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at)
    VALUES (?, ?, 'Test Path', 10, 'strict', ?, ?)
  `).run(pathId, jobId, now, now)
}

// ---- Arbitraries ----

const arbId = () => fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)
const arbIsoDate = () =>
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ts => new Date(ts).toISOString())

const arbScrapReason = (): fc.Arbitrary<ScrapReason> =>
  fc.constantFrom('out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other')

const arbPartInProgress = (jobId: string, pathId: string): fc.Arbitrary<Part> =>
  fc.record({
    id: arbId(),
    jobId: fc.constant(jobId),
    pathId: fc.constant(pathId),
    currentStepIndex: fc.integer({ min: 0, max: 20 }),
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
    currentStepIndex: fc.integer({ min: 0, max: 20 }),
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
    currentStepIndex: fc.constant(-1),
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
    currentStepIndex: part.currentStepIndex,
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

  afterEach(() => {
    if (db) db.close()
  })

  it('create then getById returns an equivalent Part object', () => {
    const JOB_ID = 'job_roundtrip'
    const PATH_ID = 'path_roundtrip'

    fc.assert(
      fc.property(arbPart(JOB_ID, PATH_ID), (part) => {
        db = createTestDb()
        seedPrerequisites(db, JOB_ID, PATH_ID)
        const repo = new SQLitePartRepository(db)

        repo.create(part)
        const retrieved = repo.getById(part.id)

        expect(retrieved).not.toBeNull()
        expect(normalizePart(retrieved!)).toEqual(normalizePart(part))

        db.close()
        db = null as any
      }),
      { numRuns: 100 },
    )
  })

  it('create then listByJobId includes the created Part', () => {
    const JOB_ID = 'job_list_rt'
    const PATH_ID = 'path_list_rt'

    fc.assert(
      fc.property(arbPart(JOB_ID, PATH_ID), (part) => {
        db = createTestDb()
        seedPrerequisites(db, JOB_ID, PATH_ID)
        const repo = new SQLitePartRepository(db)

        repo.create(part)
        const list = repo.listByJobId(JOB_ID)

        expect(list.length).toBe(1)
        expect(normalizePart(list[0])).toEqual(normalizePart(part))

        db.close()
        db = null as any
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
        fc.integer({ min: 1, max: 20 }),
        arbIsoDate(),
        (part, newStepIndex, newUpdatedAt) => {
          db = createTestDb()
          seedPrerequisites(db, JOB_ID, PATH_ID)
          const repo = new SQLitePartRepository(db)

          repo.create(part)
          const updated = repo.update(part.id, {
            currentStepIndex: newStepIndex,
            updatedAt: newUpdatedAt,
          })

          expect(updated.currentStepIndex).toBe(newStepIndex)
          expect(updated.updatedAt).toBe(newUpdatedAt)

          const retrieved = repo.getById(part.id)
          expect(retrieved).not.toBeNull()
          expect(retrieved!.currentStepIndex).toBe(newStepIndex)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
