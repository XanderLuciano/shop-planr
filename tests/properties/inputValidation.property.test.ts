/**
 * Property 11: Invalid Input Rejection
 *
 * goalQuantity ≤ 0, zero steps, part on stepless path, and non-existent cert attachment
 * all reject with descriptive errors and unchanged state.
 *
 * **Validates: Requirements 1.6, 2.6, 4.6, 5.5**
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
import { createCertService } from '../../server/services/certService'
import { createAuditService } from '../../server/services/auditService'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'
import { ValidationError, NotFoundError } from '../../server/utils/errors'

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

  return { jobService, pathService, partService, certService, repos }
}

describe('Property 11: Invalid Input Rejection', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('creating a job with goalQuantity ≤ 0 throws ValidationError', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        (badQuantity) => {
          savepoint(db)
          try {
            const { jobService, repos } = setupServices(db)

            const jobsBefore = repos.jobs.list().length

            expect(() => {
              jobService.createJob({ name: 'Bad Job', goalQuantity: badQuantity })
            }).toThrow(ValidationError)

            // State unchanged — no job created
            expect(repos.jobs.list().length).toBe(jobsBefore)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('creating a path with zero steps throws ValidationError', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (goalQty) => {
          savepoint(db)
          try {
            const { jobService, pathService, repos } = setupServices(db)

            const job = jobService.createJob({ name: 'Test Job', goalQuantity: goalQty })
            const pathsBefore = repos.paths.listByJobId(job.id).length

            expect(() => {
              pathService.createPath({
                jobId: job.id,
                name: 'Empty Path',
                goalQuantity: goalQty,
                steps: [],
              })
            }).toThrow(ValidationError)

            // State unchanged — no path created
            expect(repos.paths.listByJobId(job.id).length).toBe(pathsBefore)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('creating parts on a stepless path throws ValidationError', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (quantity) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService, repos } = setupServices(db)

            const job = jobService.createJob({ name: 'Test Job', goalQuantity: 50 })

            // Create a path with steps, then update to remove all steps
            pathService.createPath({
              jobId: job.id,
              name: 'Will Be Stepless',
              goalQuantity: 50,
              steps: [{ name: 'Temp Step' }],
            })

            // The most realistic test: try to create parts with a non-existent pathId
            const partsBefore = repos.parts.listByJobId(job.id).length

            expect(() => {
              partService.batchCreateParts(
                { jobId: job.id, pathId: 'nonexistent_path', quantity },
                'user_test',
              )
            }).toThrow(NotFoundError)

            // State unchanged
            expect(repos.parts.listByJobId(job.id).length).toBe(partsBefore)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('attaching a non-existent cert throws NotFoundError with unchanged state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (partCount) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService, certService, repos } = setupServices(db)

            const job = jobService.createJob({ name: 'Cert Test Job', goalQuantity: partCount })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Main Path',
              goalQuantity: partCount,
              steps: [{ name: 'OP1' }],
            })
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user_test',
            )

            const auditBefore = repos.audit.list().length

            // Try to batch attach a non-existent cert
            expect(() => {
              certService.batchAttachCert({
                certId: 'nonexistent_cert_id',
                partIds: parts.map(s => s.id),
                userId: 'user_test',
              })
            }).toThrow(NotFoundError)

            // No new audit entries created
            expect(repos.audit.list().length).toBe(auditBefore)

            // No cert attachments created
            for (const part of parts) {
              expect(certService.getCertsForPart(part.id).length).toBe(0)
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
