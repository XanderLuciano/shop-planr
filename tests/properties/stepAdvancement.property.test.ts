/**
 * Property 3: Sequential Step Advancement
 *
 * Advancing a SN at step N results in step N+1 or completion at final step,
 * no other transitions permitted.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
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

describe('Property 3: Sequential Step Advancement', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('advancing a SN at step N results in step N+1 or completion at final step', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 1, max: 5 }),
          advanceTimes: fc.integer({ min: 0, max: 6 })
        }),
        ({ stepCount, advanceTimes }) => {
          db = createTestDb()
          const { jobService, pathService, serialService } = setupServices(db)

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`
          }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: 10,
            steps
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test'
          )
          const serialId = serials[0].id

          let previousIndex = 0
          for (let i = 0; i < advanceTimes; i++) {
            const before = serialService.getSerial(serialId)
            if (before.currentStepIndex === -1) {
              // Already completed — advancing should throw
              expect(() => serialService.advanceSerial(serialId, 'user_test')).toThrow()
              break
            }

            previousIndex = before.currentStepIndex
            const after = serialService.advanceSerial(serialId, 'user_test')

            if (previousIndex === stepCount - 1) {
              // Was at final step — should be completed
              expect(after.currentStepIndex).toBe(-1)
            } else {
              // Should advance to next step
              expect(after.currentStepIndex).toBe(previousIndex + 1)
            }
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
