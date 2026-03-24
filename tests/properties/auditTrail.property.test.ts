/**
 * Property 6: Audit Trail Immutability and Completeness
 *
 * Exactly one audit entry is created per cert attachment, SN creation batch, and SN advancement.
 * Total audit count matches operation count.
 *
 * **Validates: Requirements 5.4, 13.1, 13.2, 13.3, 13.4, 13.5**
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
import { createCertService } from '../../server/services/certService'
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
  const certService = createCertService({ certs: repos.certs }, auditService)

  return { jobService, pathService, serialService, certService, auditService, repos }
}

describe('Property 6: Audit Trail Immutability and Completeness', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('exactly one audit entry per SN creation batch, advancement, and cert attachment', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 5 }),
          snQuantity: fc.integer({ min: 1, max: 10 }),
          advanceCount: fc.integer({ min: 0, max: 8 }),
          certAttachCount: fc.integer({ min: 0, max: 5 })
        }),
        ({ stepCount, snQuantity, advanceCount, certAttachCount }) => {
          db = createTestDb()
          const { jobService, pathService, serialService, certService, auditService } = setupServices(db)

          const job = jobService.createJob({ name: 'Audit Test Job', goalQuantity: 100 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: snQuantity,
            steps
          })

          // Track expected audit counts
          let expectedCreationAudits = 0
          let expectedAdvancementAudits = 0
          let expectedCompletionAudits = 0
          let expectedCertAudits = 0

          // 1. Batch create serials — one audit entry per batch
          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: snQuantity },
            'user_test'
          )
          expectedCreationAudits = 1

          // 2. Advance some serials — one audit entry per successful advancement
          const advanceable = Math.min(advanceCount, serials.length)
          for (let i = 0; i < advanceable; i++) {
            try {
              const serial = serialService.getSerial(serials[i].id)
              if (serial.currentStepIndex === -1) continue
              serialService.advanceSerial(serials[i].id, 'user_test')
              const updated = serialService.getSerial(serials[i].id)
              if (updated.currentStepIndex === -1) {
                expectedCompletionAudits++
              } else {
                expectedAdvancementAudits++
              }
            } catch {
              // Already completed — skip
            }
          }

          // 3. Attach certs — one audit entry per attachment
          const attachCount = Math.min(certAttachCount, serials.length)
          if (attachCount > 0) {
            const cert = certService.createCert({ type: 'material', name: 'Test Cert' })
            for (let i = 0; i < attachCount; i++) {
              const serial = serialService.getSerial(serials[i].id)
              const stepIdx = serial.currentStepIndex === -1 ? stepCount - 1 : serial.currentStepIndex
              const stepId = path.steps[stepIdx].id
              certService.attachCertToSerial({
                certId: cert.id,
                serialId: serials[i].id,
                stepId,
                userId: 'user_test',
                jobId: job.id,
                pathId: path.id
              })
              expectedCertAudits++
            }
          }

          // ASSERT: total audit entries match expected operation count
          const allAudits = auditService.listAuditEntries({ limit: 10000 })
          const expectedTotal = expectedCreationAudits + expectedAdvancementAudits + expectedCompletionAudits + expectedCertAudits
          expect(allAudits.length).toBe(expectedTotal)

          // Verify counts by action type
          const creationAudits = allAudits.filter(a => a.action === 'serial_created')
          const advancementAudits = allAudits.filter(a => a.action === 'serial_advanced')
          const completionAudits = allAudits.filter(a => a.action === 'serial_completed')
          const certAudits = allAudits.filter(a => a.action === 'cert_attached')

          expect(creationAudits.length).toBe(expectedCreationAudits)
          expect(advancementAudits.length).toBe(expectedAdvancementAudits)
          expect(completionAudits.length).toBe(expectedCompletionAudits)
          expect(certAudits.length).toBe(expectedCertAudits)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  it('audit entries for a serial are returned in chronological order', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 5 }),
          advanceTimes: fc.integer({ min: 1, max: 4 })
        }),
        ({ stepCount, advanceTimes }) => {
          db = createTestDb()
          const { jobService, pathService, serialService, auditService } = setupServices(db)

          const job = jobService.createJob({ name: 'Chrono Test', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: 1,
            steps
          })

          const [serial] = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test'
          )

          const times = Math.min(advanceTimes, stepCount)
          for (let i = 0; i < times; i++) {
            try {
              serialService.advanceSerial(serial.id, 'user_test')
            } catch {
              break
            }
          }

          // Audit trail for this serial should be in chronological order
          const trail = auditService.getSerialAuditTrail(serial.id)
          for (let i = 1; i < trail.length; i++) {
            expect(trail[i].timestamp >= trail[i - 1].timestamp).toBe(true)
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
