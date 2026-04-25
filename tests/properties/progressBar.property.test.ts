/**
 * Property 7: Progress Bar Accuracy
 *
 * Progress percentage equals `(completed / goal) * 100`.
 * Can exceed 100 when completed > goal.
 * Recalculates correctly on goal change.
 *
 * **Validates: Requirements 1.3, 1.5, 7.1, 7.6**
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

describe('Property 7: Progress Bar Accuracy', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('progress percentage equals (completed / goal) * 100', () => {
    fc.assert(
      fc.property(
        fc.record({
          goalQuantity: fc.integer({ min: 1, max: 100 }),
          partQuantity: fc.integer({ min: 1, max: 50 }),
          completionCount: fc.integer({ min: 0, max: 50 }),
        }),
        ({ goalQuantity, partQuantity, completionCount }) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService } = setupServices(db)

            const job = jobService.createJob({ name: 'Progress Test', goalQuantity })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: partQuantity,
              steps: [{ name: 'Only Step' }],
            })

            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partQuantity },
              'user_test',
            )

            const toComplete = Math.min(completionCount, parts.length)
            for (let i = 0; i < toComplete; i++) {
              try {
                partService.advancePart(parts[i].id, 'user_test')
              } catch {
                // Already completed
              }
            }

            const progress = jobService.computeJobProgress(job.id)
            const expectedPercent = (toComplete / goalQuantity) * 100

            expect(progress.progressPercent).toBeCloseTo(expectedPercent, 10)
            expect(progress.completedParts).toBe(toComplete)
            expect(progress.goalQuantity).toBe(goalQuantity)

            if (toComplete > goalQuantity) {
              expect(progress.progressPercent).toBeGreaterThan(100)
            }
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('recalculates correctly after goal quantity change', () => {
    fc.assert(
      fc.property(
        fc.record({
          initialGoal: fc.integer({ min: 1, max: 50 }),
          newGoal: fc.integer({ min: 1, max: 50 }),
          partQuantity: fc.integer({ min: 1, max: 20 }),
          completionCount: fc.integer({ min: 0, max: 20 }),
        }),
        ({ initialGoal, newGoal, partQuantity, completionCount }) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService } = setupServices(db)

            const job = jobService.createJob({ name: 'Goal Change Test', goalQuantity: initialGoal })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: partQuantity,
              steps: [{ name: 'Only Step' }],
            })

            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partQuantity },
              'user_test',
            )

            const toComplete = Math.min(completionCount, parts.length)
            for (let i = 0; i < toComplete; i++) {
              try {
                partService.advancePart(parts[i].id, 'user_test')
              } catch {
                break
              }
            }

            jobService.updateJob(job.id, { goalQuantity: newGoal })

            const progress = jobService.computeJobProgress(job.id)
            const expectedPercent = (toComplete / newGoal) * 100

            expect(progress.progressPercent).toBeCloseTo(expectedPercent, 10)
            expect(progress.goalQuantity).toBe(newGoal)
          } finally {
            rollback(db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
