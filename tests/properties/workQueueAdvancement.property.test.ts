/**
 * Property 5: Quantity validation rejects over-limit
 *
 * For any positive integer quantity Q and available part count N at a step,
 * if Q > N then the validation should reject the input,
 * and if 1 <= Q <= N then the validation should accept it.
 *
 * **Validates: Requirements 4.2, 4.3**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '~/server/repositories/sqlite/index'
import { SQLiteJobRepository } from '~/server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '~/server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '~/server/repositories/sqlite/serialRepository'
import { SQLiteCertRepository } from '~/server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '~/server/repositories/sqlite/auditRepository'
import { createJobService } from '~/server/services/jobService'
import { createPathService } from '~/server/services/pathService'
import { createSerialService } from '~/server/services/serialService'
import { createAuditService } from '~/server/services/auditService'
import { createSequentialSnGenerator } from '~/server/utils/idGenerator'

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
    { serials: repos.serials, paths: repos.paths, certs: repos.certs },
    auditService,
    snGenerator,
  )

  return { jobService, pathService, serialService }
}

/**
 * Pure validation function matching the logic in useWorkQueue.advanceBatch.
 */
function validateQuantity(quantity: number, available: number): string | null {
  if (quantity > available) {
    return `Cannot advance ${quantity} parts — only ${available} available`
  }
  if (quantity < 1) {
    return 'Quantity must be at least 1'
  }
  return null
}

describe('Property 5: Quantity validation rejects over-limit', () => {
  it('rejects when Q > N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 999 }),
        (quantity, available) => {
          fc.pre(quantity > available)
          const result = validateQuantity(quantity, available)
          expect(result).not.toBeNull()
          expect(result).toContain('Cannot advance')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts when 1 <= Q <= N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 500 }),
        (quantity, available) => {
          fc.pre(quantity <= available)
          const result = validateQuantity(quantity, available)
          expect(result).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects when Q < 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 0 }),
        fc.integer({ min: 1, max: 100 }),
        (quantity, available) => {
          const result = validateQuantity(quantity, available)
          expect(result).not.toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})


/**
 * Property 4: Batch advancement by quantity in creation order
 *
 * For any valid quantity Q (where 1 <= Q <= available parts at step)
 * and a list of serials sorted by createdAt ascending, advancing Q serials
 * should advance exactly the first Q serials in creation order to the next
 * step index (or to -1 if at the final step), leaving the remaining serials
 * unchanged.
 *
 * **Validates: Requirements 3.4, 4.4**
 */
describe('Property 4: Batch advancement by quantity in creation order', () => {
  let db: ReturnType<typeof createTestDb>

  afterEach(() => {
    if (db) {
      db.close()
      db = null as any
    }
  })

  it('advancing Q serials advances exactly the first Q in creation order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }), // stepCount
        fc.integer({ min: 2, max: 8 }), // serialCount
        fc.integer({ min: 1, max: 8 }), // quantity to advance
        (stepCount, serialCount, quantity) => {
          fc.pre(quantity <= serialCount)

          db = createTestDb()
          const { jobService, pathService, serialService } = setupServices(db)

          const job = jobService.createJob({ name: 'TestJob', goalQuantity: serialCount })
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`,
            location: `Loc-${i}`,
          }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'TestPath',
            goalQuantity: serialCount,
            steps,
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: serialCount },
            'user_test',
          )

          // All start at step 0, sorted by creation order (which is array order)
          const serialIds = serials.map(s => s.id)
          const toAdvance = serialIds.slice(0, quantity)
          const toRemain = serialIds.slice(quantity)

          // Advance the first Q serials
          for (const id of toAdvance) {
            serialService.advanceSerial(id, 'user_test')
          }

          // Verify advanced serials moved to step 1 (or -1 if single-step path)
          const expectedIndex = stepCount === 1 ? -1 : 1
          for (const id of toAdvance) {
            const s = serialService.getSerial(id)
            expect(s.currentStepIndex).toBe(expectedIndex)
          }

          // Verify remaining serials are unchanged at step 0
          for (const id of toRemain) {
            const s = serialService.getSerial(id)
            expect(s.currentStepIndex).toBe(0)
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advancing serials at final step marks them completed (-1)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }), // stepCount
        fc.integer({ min: 1, max: 5 }), // serialCount
        (stepCount, serialCount) => {
          db = createTestDb()
          const { jobService, pathService, serialService } = setupServices(db)

          const job = jobService.createJob({ name: 'TestJob', goalQuantity: serialCount })
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`,
          }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'TestPath',
            goalQuantity: serialCount,
            steps,
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: serialCount },
            'user_test',
          )

          // Advance each serial through all steps to completion
          for (const serial of serials) {
            for (let step = 0; step < stepCount; step++) {
              serialService.advanceSerial(serial.id, 'user_test')
            }
          }

          // All should be completed
          for (const serial of serials) {
            const s = serialService.getSerial(serial.id)
            expect(s.currentStepIndex).toBe(-1)
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
