/**
 * Property 4: Process Step Count Conservation
 *
 * Sum of parts at each step plus completed parts equals total parts created on that Path.
 * No parts are lost or duplicated during advancement.
 *
 * **Validates: Requirements 3.4, 2.4, 7.4**
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

describe('Property 4: Process Step Count Conservation', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('sum of parts at each step plus completed parts equals total parts created', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 1, max: 5 }),
          partQuantity: fc.integer({ min: 1, max: 20 }),
          // Which parts to advance and how many times (indices into part array)
          advanceOps: fc.array(
            fc.record({
              partIndex: fc.nat(),
              times: fc.integer({ min: 1, max: 6 }),
            }),
            { minLength: 0, maxLength: 15 },
          ),
        }),
        ({ stepCount, partQuantity, advanceOps }) => {
          savepoint(db)
          try {
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
              'user_test',
            )
            const totalCreated = parts.length

            // Advance some parts randomly
            for (const op of advanceOps) {
              const idx = op.partIndex % parts.length
              for (let t = 0; t < op.times; t++) {
                try {
                  partService.advancePart(parts[idx].id, 'user_test')
                } catch {
                  // Already completed — skip
                  break
                }
              }
            }

            // Count parts at each step by currentStepId + completed (null)
            let countSum = 0
            for (const step of path.steps) {
              countSum += partService.listPartsByCurrentStepId(step.id).length
            }
            // Add completed parts (currentStepId === null)
            const allParts = partService.listPartsByPath(path.id)
            countSum += allParts.filter(p => p.currentStepId === null && p.status !== 'scrapped').length

            // ASSERT: conservation — no parts lost or duplicated
            expect(countSum).toBe(totalCreated)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
