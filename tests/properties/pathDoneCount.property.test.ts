/**
 * Property Tests: Path Done Count
 *
 * CP-DONE-1: Path completed count equals parts with currentStepIndex === -1
 * CP-DONE-2: Distribution completedCount entries are always 0
 *
 * **Validates: Requirements 1.1, 1.2, 2.2**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
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

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')
  runMigrations(db, migrationsDir)
  return db
}

function setupServices(db: Database.default.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db),
  }

  const partIdGenerator = createSequentialPartIdGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as
        | { value: number }
        | undefined
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
    { parts: repos.parts, paths: repos.paths, certs: repos.certs },
    auditService,
    partIdGenerator
  )

  return { jobService, pathService, partService }
}

describe('Path Done Count Properties', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  /**
   * CP-DONE-1: Path completed count equals parts with currentStepIndex === -1
   *
   * ∀ pathId: getPathCompletedCount(pathId) ===
   *   partService.listPartsByStepIndex(pathId, -1).length
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('CP-DONE-1: getPathCompletedCount equals count of parts with stepIndex -1', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 1, max: 5 }),
          partQuantity: fc.integer({ min: 1, max: 20 }),
          advanceOps: fc.array(
            fc.record({
              partIndex: fc.nat(),
              times: fc.integer({ min: 1, max: 6 }),
            }),
            { minLength: 0, maxLength: 15 }
          ),
        }),
        ({ stepCount, partQuantity, advanceOps }) => {
          db = createTestDb()
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: 100 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`,
          }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: partQuantity,
            steps,
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: partQuantity },
            'user_test'
          )

          // Advance some parts randomly
          for (const op of advanceOps) {
            const idx = op.partIndex % parts.length
            for (let t = 0; t < op.times; t++) {
              try {
                partService.advancePart(parts[idx].id, 'user_test')
              } catch {
                break
              }
            }
          }

          // ASSERT: getPathCompletedCount matches parts with stepIndex -1
          const completedCount = pathService.getPathCompletedCount(path.id)
          const partsAtMinusOne = partService.listPartsByStepIndex(path.id, -1).length

          expect(completedCount).toBe(partsAtMinusOne)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * CP-DONE-2: Distribution completedCount entries are always 0
   *
   * ∀ pathId: getStepDistribution(pathId).every(d => d.completedCount === 0)
   *
   * **Validates: Requirements 2.2**
   */
  it('CP-DONE-2: distribution completedCount entries are always 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 1, max: 5 }),
          partQuantity: fc.integer({ min: 1, max: 20 }),
          advanceOps: fc.array(
            fc.record({
              partIndex: fc.nat(),
              times: fc.integer({ min: 1, max: 6 }),
            }),
            { minLength: 0, maxLength: 15 }
          ),
        }),
        ({ stepCount, partQuantity, advanceOps }) => {
          db = createTestDb()
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: 100 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`,
          }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: partQuantity,
            steps,
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: partQuantity },
            'user_test'
          )

          // Advance some parts randomly
          for (const op of advanceOps) {
            const idx = op.partIndex % parts.length
            for (let t = 0; t < op.times; t++) {
              try {
                partService.advancePart(parts[idx].id, 'user_test')
              } catch {
                break
              }
            }
          }

          // ASSERT: every distribution entry has completedCount === 0
          const distribution = pathService.getStepDistribution(path.id)
          expect(distribution.every((d) => d.completedCount === 0)).toBe(true)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
