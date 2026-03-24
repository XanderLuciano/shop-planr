/**
 * Property 10: Batch Certificate Application Idempotence
 *
 * Applying the same Certificate to the same set of Serial Numbers a second time
 * produces the same state as applying it once. The set of Certificates on each
 * Serial Number remains unchanged after re-application. Audit entries are only
 * created on the first application (second is idempotent due to UNIQUE constraint).
 *
 * **Validates: Requirements 5.3, 5.6**
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

function setupServices(db: InstanceType<typeof Database>) {
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

  return { jobService, pathService, serialService, certService, repos }
}

describe('Property 10: Batch Certificate Application Idempotence', () => {
  let db: InstanceType<typeof Database>

  afterEach(() => {
    if (db) db.close()
  })

  it('applying same cert to same serials twice produces same state as once', () => {
    fc.assert(
      fc.property(
        fc.record({
          serialCount: fc.integer({ min: 1, max: 10 }),
          certType: fc.constantFrom('material' as const, 'process' as const)
        }),
        ({ serialCount, certType }) => {
          db = createTestDb()
          const { jobService, pathService, serialService, certService, repos } = setupServices(db)

          // Create a job with a path that has steps
          const job = jobService.createJob({ name: 'Idempotence Job', goalQuantity: serialCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Main Path',
            goalQuantity: serialCount,
            steps: [{ name: 'OP1' }, { name: 'OP2' }]
          })
          const stepId = path.steps[0].id

          // Create serials
          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: serialCount },
            'user_test'
          )

          // Create a certificate
          const cert = certService.createCert({ type: certType, name: 'Test Cert' })

          // First application: attach cert to each serial at step via repository batchAttach
          const now = new Date().toISOString()
          const attachments = serials.map(s => ({
            serialId: s.id,
            certId: cert.id,
            stepId,
            attachedAt: now,
            attachedBy: 'user_test'
          }))
          const firstResult = repos.certs.batchAttach(attachments)

          // Snapshot state after first application
          const attachmentsAfterFirst: Record<string, string[]> = {}
          for (const s of serials) {
            attachmentsAfterFirst[s.id] = certService.getCertsForSerial(s.id).map(a => a.certId).sort()
          }
          const auditCountBefore = repos.audit.list().length

          // Second application: same cert, same serials, same step (should be idempotent)
          const secondResult = repos.certs.batchAttach(attachments)

          // Snapshot state after second application
          const attachmentsAfterSecond: Record<string, string[]> = {}
          for (const s of serials) {
            attachmentsAfterSecond[s.id] = certService.getCertsForSerial(s.id).map(a => a.certId).sort()
          }

          // ASSERT: cert attachments are identical after second application
          expect(attachmentsAfterSecond).toEqual(attachmentsAfterFirst)

          // ASSERT: each serial has exactly one attachment for this cert
          for (const s of serials) {
            const certs = certService.getCertsForSerial(s.id).filter(a => a.certId === cert.id)
            expect(certs.length).toBe(1)
          }

          // ASSERT: both calls return the same number of results
          expect(secondResult.length).toBe(firstResult.length)

          // ASSERT: audit count didn't change (no new audit entries from repo-level batchAttach)
          expect(repos.audit.list().length).toBe(auditCountBefore)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
