/**
 * Property 1: Job Part Count Invariant
 *
 * For any Job with any number of Paths, after any sequence of part creation/advancement/completion,
 * the Job's total part count equals the sum of part counts across all Paths.
 *
 * **Validates: Requirements 1.4, 7.5**
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

  return { jobService, pathService, partService, repos }
}

describe('Property 1: Job Part Count Invariant', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('job part count equals sum of part counts across all paths after any sequence of operations', () => {
    fc.assert(
      fc.property(
        // Generate 1-3 paths, each with 1-5 steps
        fc.array(
          fc.record({
            stepCount: fc.integer({ min: 1, max: 5 }),
            partQuantity: fc.integer({ min: 1, max: 20 }),
            advanceCount: fc.integer({ min: 0, max: 10 }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        (pathConfigs) => {
          db = createTestDb()
          const { jobService, pathService, partService } = setupServices(db)

          // Create a job
          const job = jobService.createJob({ name: 'Test Job', goalQuantity: 100 })

          const pathIds: string[] = []
          for (const config of pathConfigs) {
            // Create steps for this path
            const steps = Array.from({ length: config.stepCount }, (_, i) => ({
              name: `Step ${i}`,
            }))

            const path = pathService.createPath({
              jobId: job.id,
              name: `Path ${pathIds.length}`,
              goalQuantity: config.partQuantity,
              steps,
            })
            pathIds.push(path.id)

            // Create parts on this path
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: config.partQuantity },
              'user_test',
            )

            // Advance some parts randomly
            const advanceable = Math.min(config.advanceCount, parts.length)
            for (let i = 0; i < advanceable; i++) {
              try {
                partService.advancePart(parts[i].id, 'user_test')
              } catch {
                // Part may already be completed — that's fine
              }
            }
          }

          // ASSERT: jobService.getJobPartCount === sum of parts across all paths
          const jobPartCount = jobService.getJobPartCount(job.id)

          let sumAcrossPaths = 0
          for (const pathId of pathIds) {
            sumAcrossPaths += partService.listPartsByPath(pathId).length
          }

          expect(jobPartCount).toBe(sumAcrossPaths)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
