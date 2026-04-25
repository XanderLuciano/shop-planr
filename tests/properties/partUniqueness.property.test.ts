/**
 * Property 2: Part ID Uniqueness
 *
 * For any sequence of batch part creation operations across any number of Jobs and Paths,
 * all part identifiers are unique.
 *
 * **Validates: Requirements 4.1, 4.2**
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

describe('Property 2: Part ID Uniqueness', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('all part identifiers are unique across multiple jobs, paths, and batch creates', () => {
    fc.assert(
      fc.property(
        // Generate 1-3 jobs, each with 1-3 paths, each with 1-20 parts
        fc.array(
          fc.array(
            fc.integer({ min: 1, max: 20 }),
            { minLength: 1, maxLength: 3 },
          ),
          { minLength: 1, maxLength: 3 },
        ),
        (jobPathQuantities) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService } = setupServices(db)

            const allPartIds: string[] = []

            for (let j = 0; j < jobPathQuantities.length; j++) {
              const job = jobService.createJob({
                name: `Job ${j}`,
                goalQuantity: 100,
              })

              for (let p = 0; p < jobPathQuantities[j].length; p++) {
                const quantity = jobPathQuantities[j][p]
                const path = pathService.createPath({
                  jobId: job.id,
                  name: `Path ${p}`,
                  goalQuantity: quantity,
                  steps: [{ name: 'OP1' }, { name: 'OP2' }],
                })

                const parts = partService.batchCreateParts(
                  { jobId: job.id, pathId: path.id, quantity },
                  'user_test',
                )

                for (const s of parts) {
                  allPartIds.push(s.id)
                }
              }
            }

            // ASSERT: all IDs are unique
            const uniqueIds = new Set(allPartIds)
            expect(uniqueIds.size).toBe(allPartIds.length)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
