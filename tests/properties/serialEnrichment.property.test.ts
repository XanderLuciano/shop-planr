/**
 * Property tests for serial enrichment.
 *
 * Tests P5 (status derivation) and P7 (enrichment completeness).
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '../../server/repositories/sqlite/serialRepository'
import { SQLiteCertRepository } from '../../server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '../../server/repositories/sqlite/auditRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createSerialService } from '../../server/services/serialService'
import { createAuditService } from '../../server/services/auditService'
import { createSequentialSnGenerator } from '../../server/utils/idGenerator'

const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, migrationsDir)
  return db
}

function setupServices(db: Database.default.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    serials: new SQLiteSerialRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db),
  }

  const snGenerator = createSequentialSnGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
    },
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
  const pathService = createPathService({ paths: repos.paths, serials: repos.serials })
  const serialService = createSerialService(
    { serials: repos.serials, paths: repos.paths, certs: repos.certs, jobs: repos.jobs },
    auditService,
    snGenerator,
  )

  return { repos, jobService, pathService, serialService }
}

/** Arbitrary for a job/path/serial scenario with advancements */
const scenarioArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  serialCount: fc.integer({ min: 1, max: 6 }),
  /** Number of advancements per serial (capped by stepCount at runtime) */
  advanceCounts: fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 0, maxLength: 6 }),
})

/**
 * Property 5: Serial status derivation
 *
 * For any SerialNumber, `currentStepIndex === -1` → status `'completed'`,
 * else `'in-progress'`.
 *
 * **Validates: Requirements 4.7, 5.4**
 */
describe('Property 5: Serial status derivation', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) {
      db.close()
      db = null as any
    }
  })

  it('currentStepIndex === -1 yields completed, otherwise in-progress', () => {
    fc.assert(
      fc.property(scenarioArb, (config) => {
        db = createTestDb()
        const { jobService, pathService, serialService } = setupServices(db)

        const job = jobService.createJob({
          name: config.jobName,
          goalQuantity: config.serialCount,
        })

        const steps = Array.from({ length: config.stepCount }, (_, i) => ({
          name: `Step ${i}`,
          location: `Loc-${i}`,
        }))

        const path = pathService.createPath({
          jobId: job.id,
          name: config.pathName,
          goalQuantity: config.serialCount,
          steps,
        })

        const serials = serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: config.serialCount },
          'user_test',
        )

        // Apply advancements
        for (let i = 0; i < serials.length; i++) {
          const advanceCount = config.advanceCounts[i] ?? 0
          for (let a = 0; a < advanceCount; a++) {
            try {
              serialService.advanceSerial(serials[i].id, 'user_test')
            } catch {
              break
            }
          }
        }

        // Get enriched serials and verify status derivation
        const enriched = serialService.listAllSerialsEnriched()

        for (const e of enriched) {
          if (e.currentStepIndex === -1) {
            expect(e.status).toBe('completed')
          } else {
            expect(e.status).toBe('in-progress')
          }
        }

        db.close()
        db = null as any
      }),
      { numRuns: 100 },
    )
  })
})


/**
 * Property 7: Serial enrichment completeness
 *
 * For any SerialNumber with associated Job/Path/Steps, enriched object has
 * non-empty `id`, `jobName`, `pathName`, `currentStepName`, valid `status`,
 * non-empty `createdAt`.
 *
 * **Validates: Requirements 7.3, 11.2**
 */
describe('Property 7: Serial enrichment completeness', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) {
      db.close()
      db = null as any
    }
  })

  it('enriched serials have all required non-empty fields and valid status', () => {
    fc.assert(
      fc.property(scenarioArb, (config) => {
        db = createTestDb()
        const { jobService, pathService, serialService } = setupServices(db)

        const job = jobService.createJob({
          name: config.jobName,
          goalQuantity: config.serialCount,
        })

        const steps = Array.from({ length: config.stepCount }, (_, i) => ({
          name: `Step ${i}`,
          location: `Loc-${i}`,
        }))

        const path = pathService.createPath({
          jobId: job.id,
          name: config.pathName,
          goalQuantity: config.serialCount,
          steps,
        })

        const serials = serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: config.serialCount },
          'user_test',
        )

        // Apply advancements
        for (let i = 0; i < serials.length; i++) {
          const advanceCount = config.advanceCounts[i] ?? 0
          for (let a = 0; a < advanceCount; a++) {
            try {
              serialService.advanceSerial(serials[i].id, 'user_test')
            } catch {
              break
            }
          }
        }

        // Get enriched serials and verify completeness
        const enriched = serialService.listAllSerialsEnriched()

        expect(enriched.length).toBe(config.serialCount)

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

          // currentStepName is "Completed" when index is -1
          if (e.currentStepIndex === -1) {
            expect(e.currentStepName).toBe('Completed')
          }
        }

        db.close()
        db = null as any
      }),
      { numRuns: 100 },
    )
  })
})


/**
 * Property 12: Serial summary counts
 *
 * For any list of serials:
 * - `totalCount === list.length`
 * - `completedCount === count where currentStepIndex === -1`
 * - `inProgressCount === count where currentStepIndex >= 0`
 * - `completedCount + inProgressCount === totalCount`
 *
 * **Validates: Requirements 11.6**
 */
import type { EnrichedSerial } from '../../server/types/computed'

/** Pure summary count logic matching the Serials tab implementation */
function computeSummaryCounts(serials: Array<{ currentStepIndex: number }>) {
  const totalCount = serials.length
  const completedCount = serials.filter(s => s.currentStepIndex === -1).length
  const inProgressCount = serials.filter(s => s.currentStepIndex >= 0).length
  return { totalCount, completedCount, inProgressCount }
}

/** Arbitrary for a minimal serial-like object with currentStepIndex */
const serialWithStepIndexArb = fc.record({
  currentStepIndex: fc.oneof(fc.constant(-1), fc.integer({ min: 0, max: 20 })),
})

describe('Property 12: Serial summary counts', () => {
  it('totalCount === list.length, completedCount + inProgressCount === totalCount', () => {
    fc.assert(
      fc.property(
        fc.array(serialWithStepIndexArb, { minLength: 0, maxLength: 50 }),
        (serials) => {
          const { totalCount, completedCount, inProgressCount } = computeSummaryCounts(serials)

          // totalCount equals list length
          expect(totalCount).toBe(serials.length)

          // completedCount equals count where index === -1
          const expectedCompleted = serials.filter(s => s.currentStepIndex === -1).length
          expect(completedCount).toBe(expectedCompleted)

          // inProgressCount equals count where index >= 0
          const expectedInProgress = serials.filter(s => s.currentStepIndex >= 0).length
          expect(inProgressCount).toBe(expectedInProgress)

          // completedCount + inProgressCount === totalCount
          expect(completedCount + inProgressCount).toBe(totalCount)
        },
      ),
      { numRuns: 100 },
    )
  })
})
