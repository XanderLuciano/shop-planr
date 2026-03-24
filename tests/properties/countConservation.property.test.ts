/**
 * Property 4: Process Step Count Conservation
 *
 * Sum of SNs at each step plus completed SNs equals total SNs created on that Path.
 * No serial numbers are lost or duplicated during advancement.
 *
 * **Validates: Requirements 3.4, 2.4, 7.4**
 */
import { describe, it, afterEach } from 'vitest'
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
    serials: new SQLiteSerialRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db)
  }

  const snGenerator = createSequentialSnGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
    }
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
  const pathService = createPathService({ paths: repos.paths, serials: repos.serials })
  const serialService = createSerialService(
    { serials: repos.serials, paths: repos.paths, certs: repos.certs },
    auditService,
    snGenerator
  )

  return { jobService, pathService, serialService }
}

describe('Property 4: Process Step Count Conservation', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('sum of SNs at each step plus completed SNs equals total SNs created', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 1, max: 5 }),
          snQuantity: fc.integer({ min: 1, max: 20 }),
          // Which serials to advance and how many times (indices into serial array)
          advanceOps: fc.array(
            fc.record({
              serialIndex: fc.nat(),
              times: fc.integer({ min: 1, max: 6 })
            }),
            { minLength: 0, maxLength: 15 }
          )
        }),
        ({ stepCount, snQuantity, advanceOps }) => {
          db = createTestDb()
          const { jobService, pathService, serialService } = setupServices(db)

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: 100 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`
          }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: snQuantity,
            steps
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: snQuantity },
            'user_test'
          )
          const totalCreated = serials.length

          // Advance some serials randomly
          for (const op of advanceOps) {
            const idx = op.serialIndex % serials.length
            for (let t = 0; t < op.times; t++) {
              try {
                serialService.advanceSerial(serials[idx].id, 'user_test')
              } catch {
                // Already completed — skip
                break
              }
            }
          }

          // Count SNs at each step index + completed (-1)
          let countSum = 0
          for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
            countSum += serialService.listSerialsByStepIndex(path.id, stepIdx).length
          }
          // Add completed serials (stepIndex === -1)
          countSum += serialService.listSerialsByStepIndex(path.id, -1).length

          // ASSERT: conservation — no SNs lost or duplicated
          expect(countSum).toBe(totalCreated)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
