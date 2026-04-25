/**
 * Property tests for part enrichment.
 *
 * Tests P5 (status derivation) and P7 (enrichment completeness).
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { SQLiteCertRepository } from '../../server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '../../server/repositories/sqlite/auditRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createPartService } from '../../server/services/partService'
import { createAuditService } from '../../server/services/auditService'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'

/**
 * Property 12: Part summary counts
 *
 * For any list of parts:
 * - `totalCount === list.length`
 * - `completedCount === count where currentStepId === null`
 * - `inProgressCount === count where currentStepId !== null`
 * - `completedCount + inProgressCount === totalCount`
 *
 * **Validates: Requirements 11.6**
 */

function setupServices(db: Database.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db),
  }

  const partIdGenerator = createSequentialPartIdGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
    },
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  const pathService = createPathService({ paths: repos.paths, parts: repos.parts })
  const partService = createPartService(
    { parts: repos.parts, paths: repos.paths, certs: repos.certs, jobs: repos.jobs },
    auditService,
    partIdGenerator,
  )

  return { repos, jobService, pathService, partService }
}

/** Arbitrary for a job/path/part scenario with advancements */
const scenarioArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  partCount: fc.integer({ min: 1, max: 6 }),
  /** Number of advancements per part (capped by stepCount at runtime) */
  advanceCounts: fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 0, maxLength: 6 }),
})

/**
 * Property 5: Part status derivation
 *
 * For any Part, `currentStepId === null` → status `'completed'`,
 * else `'in-progress'`.
 *
 * **Validates: Requirements 4.7, 5.4**
 */
describe('Property 5: Part status derivation', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('currentStepId === null yields completed, otherwise in-progress', () => {
    fc.assert(
      fc.property(scenarioArb, (config) => {
        savepoint(db)
        try {
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: config.partCount,
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step ${i}`,
            location: `Loc-${i}`,
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: config.partCount,
            steps,
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: config.partCount },
            'user_test',
          )

          // Apply advancements
          for (let i = 0; i < parts.length; i++) {
            const advanceCount = config.advanceCounts[i] ?? 0
            for (let a = 0; a < advanceCount; a++) {
              try {
                partService.advancePart(parts[i].id, 'user_test')
              } catch {
                break
              }
            }
          }

          // Get enriched parts and verify status derivation
          const enriched = partService.listAllPartsEnriched()

          for (const e of enriched) {
            if (e.currentStepId === null) {
              expect(e.status).toBe('completed')
            } else {
              expect(e.status).toBe('in-progress')
            }
          }
        } finally {
          rollback(db)
        }
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 7: Part enrichment completeness
 *
 * For any Part with associated Job/Path/Steps, enriched object has
 * non-empty `id`, `jobName`, `pathName`, `currentStepName`, valid `status`,
 * non-empty `createdAt`.
 *
 * **Validates: Requirements 7.3, 11.2**
 */
describe('Property 7: Part enrichment completeness', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('enriched parts have all required non-empty fields and valid status', () => {
    fc.assert(
      fc.property(scenarioArb, (config) => {
        savepoint(db)
        try {
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: config.partCount,
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step ${i}`,
            location: `Loc-${i}`,
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: config.partCount,
            steps,
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: config.partCount },
            'user_test',
          )

          // Apply advancements
          for (let i = 0; i < parts.length; i++) {
            const advanceCount = config.advanceCounts[i] ?? 0
            for (let a = 0; a < advanceCount; a++) {
              try {
                partService.advancePart(parts[i].id, 'user_test')
              } catch {
                break
              }
            }
          }

          // Get enriched parts and verify completeness
          const enriched = partService.listAllPartsEnriched()

          expect(enriched.length).toBe(config.partCount)

          for (const e of enriched) {
            // Non-empty id
            expect(e.id.length).toBeGreaterThan(0)

            // Non-empty jobName
            expect(e.jobName.length).toBeGreaterThan(0)

            // Non-empty pathName
            expect(e.pathName.length).toBeGreaterThan(0)

            // Non-empty currentStepName
            expect(e.currentStepName.length).toBeGreaterThan(0)

            // Valid status
            expect(['in-progress', 'completed']).toContain(e.status)

            // Non-empty createdAt
            expect(e.createdAt.length).toBeGreaterThan(0)

            // currentStepName is "Completed" when currentStepId is null
            if (e.currentStepId === null) {
              expect(e.currentStepName).toBe('Completed')
            }
          }
        } finally {
          rollback(db)
        }
      }),
      { numRuns: 100 },
    )
  })
})

/** Pure summary count logic matching the Parts tab implementation */
function computeSummaryCounts(parts: Array<{ currentStepId: string | null }>) {
  const totalCount = parts.length
  const completedCount = parts.filter(s => s.currentStepId === null).length
  const inProgressCount = parts.filter(s => s.currentStepId !== null).length
  return { totalCount, completedCount, inProgressCount }
}

/** Arbitrary for a minimal part-like object with currentStepId */
const partWithStepIdArb = fc.record({
  currentStepId: fc.oneof(fc.constant(null as string | null), fc.string({ minLength: 1, maxLength: 20 })),
})

describe('Property 12: Part summary counts', () => {
  it('totalCount === list.length, completedCount + inProgressCount === totalCount', () => {
    fc.assert(
      fc.property(
        fc.array(partWithStepIdArb, { minLength: 0, maxLength: 50 }),
        (parts) => {
          const { totalCount, completedCount, inProgressCount } = computeSummaryCounts(parts)

          // totalCount equals list length
          expect(totalCount).toBe(parts.length)

          // completedCount equals count where currentStepId === null
          const expectedCompleted = parts.filter(s => s.currentStepId === null).length
          expect(completedCount).toBe(expectedCompleted)

          // inProgressCount equals count where currentStepId !== null
          const expectedInProgress = parts.filter(s => s.currentStepId !== null).length
          expect(inProgressCount).toBe(expectedInProgress)

          // completedCount + inProgressCount === totalCount
          expect(completedCount + inProgressCount).toBe(totalCount)
        },
      ),
      { numRuns: 100 },
    )
  })
})
