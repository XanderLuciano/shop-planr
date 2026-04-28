/**
 * Property 6: Audit Trail Immutability and Completeness
 *
 * Exactly one audit entry is created per cert attachment, part creation batch, and part advancement.
 * Total audit count matches operation count.
 *
 * **Validates: Requirements 5.4, 13.1, 13.2, 13.3, 13.4, 13.5**
 */
import { describe, it, afterAll, beforeAll } from 'vitest'
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
import { createCertService } from '../../server/services/certService'
import { createAuditService } from '../../server/services/auditService'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'

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
    { parts: repos.parts, paths: repos.paths, certs: repos.certs },
    auditService,
    partIdGenerator,
  )
  const certService = createCertService({ certs: repos.certs, parts: repos.parts, paths: repos.paths }, auditService)

  return { jobService, pathService, partService, certService, auditService, repos }
}

describe('Property 6: Audit Trail Immutability and Completeness', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('exactly one audit entry per part creation batch, advancement, and cert attachment', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 5 }),
          partQuantity: fc.integer({ min: 1, max: 10 }),
          advanceCount: fc.integer({ min: 0, max: 8 }),
          certAttachCount: fc.integer({ min: 0, max: 5 }),
        }),
        ({ stepCount, partQuantity, advanceCount, certAttachCount }) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService, certService, auditService } = setupServices(db)

            const job = jobService.createJob({ name: 'Audit Test Job', goalQuantity: 100 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: partQuantity,
              steps,
            })

            // Track expected audit counts
            let expectedCreationAudits = 0
            let expectedAdvancementAudits = 0
            let expectedCompletionAudits = 0
            let expectedCertAudits = 0

            // 1. Batch create parts — one audit entry per batch
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partQuantity },
              'user_test',
            )
            expectedCreationAudits = 1

            // 2. Advance some parts — one audit entry per successful advancement
            const advanceable = Math.min(advanceCount, parts.length)
            for (let i = 0; i < advanceable; i++) {
              try {
                const part = partService.getPart(parts[i].id)
                if (part.currentStepId === null) continue
                partService.advancePart(parts[i].id, 'user_test')
                const updated = partService.getPart(parts[i].id)
                if (updated.currentStepId === -1) {
                  expectedCompletionAudits++
                } else {
                  expectedAdvancementAudits++
                }
              } catch {
                // Already completed — skip
              }
            }

            // 3. Attach certs — one audit entry per attachment
            const attachCount = Math.min(certAttachCount, parts.length)
            if (attachCount > 0) {
              const cert = certService.createCert({ type: 'material', name: 'Test Cert' })
              for (let i = 0; i < attachCount; i++) {
                const part = partService.getPart(parts[i].id)
                const stepId = part.currentStepId ?? path.steps[stepCount - 1].id
                certService.attachCertToPart({
                  certId: cert.id,
                  partId: parts[i].id,
                  stepId,
                  userId: 'user_test',
                  jobId: job.id,
                  pathId: path.id,
                })
                expectedCertAudits++
              }
            }

            // ASSERT: total audit entries match expected operation count
            const allAudits = auditService.listAuditEntries({ limit: 10000 })
            const expectedTotal = expectedCreationAudits + expectedAdvancementAudits + expectedCompletionAudits + expectedCertAudits
            expect(allAudits.length).toBe(expectedTotal)

            // Verify counts by action type
            const creationAudits = allAudits.filter(a => a.action === 'part_created')
            const advancementAudits = allAudits.filter(a => a.action === 'part_advanced')
            const completionAudits = allAudits.filter(a => a.action === 'part_completed')
            const certAudits = allAudits.filter(a => a.action === 'cert_attached')

            expect(creationAudits.length).toBe(expectedCreationAudits)
            expect(advancementAudits.length).toBe(expectedAdvancementAudits)
            expect(completionAudits.length).toBe(expectedCompletionAudits)
            expect(certAudits.length).toBe(expectedCertAudits)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('audit entries for a part are returned in chronological order', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 5 }),
          advanceTimes: fc.integer({ min: 1, max: 4 }),
        }),
        ({ stepCount, advanceTimes }) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService, auditService } = setupServices(db)

            const job = jobService.createJob({ name: 'Chrono Test', goalQuantity: 10 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: 1,
              steps,
            })

            const [part] = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 },
              'user_test',
            )

            const times = Math.min(advanceTimes, stepCount)
            for (let i = 0; i < times; i++) {
              try {
                partService.advancePart(part.id, 'user_test')
              } catch {
                break
              }
            }

            // Audit trail for this part should be in chronological order
            const trail = auditService.getPartAuditTrail(part.id)
            for (let i = 1; i < trail.length; i++) {
              expect(trail[i].timestamp >= trail[i - 1].timestamp).toBe(true)
            }
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
