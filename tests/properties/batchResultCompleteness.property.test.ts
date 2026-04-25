/**
 * Property 1: Batch result completeness
 *
 * For any array of part IDs passed to batchAdvanceParts, the results array
 * SHALL have exactly one entry per input ID, and the sum of advanced and
 * failed counts SHALL equal the input array length.
 *
 * **Validates: Requirements 2.1, 2.2**
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

  return { jobService, pathService, partService }
}

describe('Property 1: Batch result completeness', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('results.length === partIds.length and advanced + failed === partIds.length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        (partCount) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService } = setupServices(db)

            const job = jobService.createJob({ name: 'Completeness Job', goalQuantity: partCount })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Main Path',
              goalQuantity: partCount,
              steps: [{ name: 'OP1' }, { name: 'OP2' }],
            })

            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user_test',
            )

            const partIds = parts.map(p => p.id)
            const result = partService.batchAdvanceParts(partIds, 'user_test')

            // ASSERT: one result per input ID
            expect(result.results.length).toBe(partIds.length)

            // ASSERT: advanced + failed === input length
            expect(result.advanced + result.failed).toBe(partIds.length)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
