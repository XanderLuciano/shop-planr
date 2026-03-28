/**
 * Property 7: Progress Bar Accuracy
 *
 * Progress percentage equals `(completed / goal) * 100`.
 * Can exceed 100 when completed > goal.
 * Recalculates correctly on goal change.
 *
 * **Validates: Requirements 1.3, 1.5, 7.1, 7.6**
 */
import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
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
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db)
  }

  const partIdGenerator = createSequentialPartIdGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
    }
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  const pathService = createPathService({ paths: repos.paths, parts: repos.parts })
  const partService = createPartService(
    { parts: repos.parts, paths: repos.paths, certs: repos.certs },
    auditService,
    partIdGenerator
  )

  return { jobService, pathService, partService }
}

describe('Property 7: Progress Bar Accuracy', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('progress percentage equals (completed / goal) * 100', () => {
    fc.assert(
      fc.property(
        fc.record({
          goalQuantity: fc.integer({ min: 1, max: 100 }),
          partQuantity: fc.integer({ min: 1, max: 50 }),
          // How many parts to advance to completion (single-step path for simplicity)
          completionCount: fc.integer({ min: 0, max: 50 })
        }),
        ({ goalQuantity, partQuantity, completionCount }) => {
          db = createTestDb()
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({ name: 'Progress Test', goalQuantity })

          // Use a single-step path so advancing = completing
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: partQuantity,
            steps: [{ name: 'Only Step' }]
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: partQuantity },
            'user_test'
          )

          // Complete some parts (advance past the single step)
          const toComplete = Math.min(completionCount, parts.length)
          for (let i = 0; i < toComplete; i++) {
            try {
              partService.advancePart(parts[i].id, 'user_test')
            } catch {
              // Already completed
            }
          }

          // ASSERT: progress percentage matches formula
          const progress = jobService.computeJobProgress(job.id)
          const expectedPercent = (toComplete / goalQuantity) * 100

          expect(progress.progressPercent).toBeCloseTo(expectedPercent, 10)
          expect(progress.completedParts).toBe(toComplete)
          expect(progress.goalQuantity).toBe(goalQuantity)

          // Can exceed 100% when completed > goal
          if (toComplete > goalQuantity) {
            expect(progress.progressPercent).toBeGreaterThan(100)
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  it('recalculates correctly after goal quantity change', () => {
    fc.assert(
      fc.property(
        fc.record({
          initialGoal: fc.integer({ min: 1, max: 50 }),
          newGoal: fc.integer({ min: 1, max: 50 }),
          partQuantity: fc.integer({ min: 1, max: 20 }),
          completionCount: fc.integer({ min: 0, max: 20 })
        }),
        ({ initialGoal, newGoal, partQuantity, completionCount }) => {
          db = createTestDb()
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({ name: 'Goal Change Test', goalQuantity: initialGoal })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Route',
            goalQuantity: partQuantity,
            steps: [{ name: 'Only Step' }]
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: partQuantity },
            'user_test'
          )

          const toComplete = Math.min(completionCount, parts.length)
          for (let i = 0; i < toComplete; i++) {
            try {
              partService.advancePart(parts[i].id, 'user_test')
            } catch {
              break
            }
          }

          // Change goal quantity
          jobService.updateJob(job.id, { goalQuantity: newGoal })

          // ASSERT: progress recalculates with new goal
          const progress = jobService.computeJobProgress(job.id)
          const expectedPercent = (toComplete / newGoal) * 100

          expect(progress.progressPercent).toBeCloseTo(expectedPercent, 10)
          expect(progress.goalQuantity).toBe(newGoal)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
