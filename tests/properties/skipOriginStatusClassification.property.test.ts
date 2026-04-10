/**
 * Property 7: Skip origin status classification
 *
 * advanceToStep with skip:true → origin marked 'skipped' (optional/overridden)
 * or 'deferred' (required).
 * advanceToStep with skip:false/omitted → origin marked 'completed'.
 *
 * **Validates: Requirements 9.1, 9.2, 9.4, 10.2**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { SQLiteAuditRepository } from '../../server/repositories/sqlite/auditRepository'
import { SQLitePartStepStatusRepository } from '../../server/repositories/sqlite/partStepStatusRepository'
import { SQLitePartStepOverrideRepository } from '../../server/repositories/sqlite/partStepOverrideRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createPartService } from '../../server/services/partService'
import { createAuditService } from '../../server/services/auditService'
import { createLifecycleService } from '../../server/services/lifecycleService'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'

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
    parts: new SQLitePartRepository(db),
    audit: new SQLiteAuditRepository(db),
    partStepStatuses: new SQLitePartStepStatusRepository(db),
    partStepOverrides: new SQLitePartStepOverrideRepository(db),
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
  const lifecycleService = createLifecycleService(
    { parts: repos.parts, paths: repos.paths, jobs: repos.jobs, partStepStatuses: repos.partStepStatuses, partStepOverrides: repos.partStepOverrides },
    auditService,
  )
  const partService = createPartService(
    { parts: repos.parts, paths: repos.paths, certs: undefined as any },
    auditService,
    partIdGenerator,
    lifecycleService,
  )

  return { jobService, pathService, partService, lifecycleService, repos }
}

describe('Property 7: Skip origin status classification', () => {
  let db: InstanceType<typeof Database>

  afterEach(() => {
    if (db) db.close()
  })

  it('skip:true marks origin as skipped (optional) or deferred (required); skip:false/omitted marks completed', () => {
    fc.assert(
      fc.property(
        fc.record({
          originOptional: fc.boolean(),
          skipFlag: fc.constantFrom(true, false, undefined),
        }),
        ({ originOptional, skipFlag }) => {
          db = createTestDb()
          const { jobService, pathService, partService, lifecycleService, repos } = setupServices(db)

          // Create job + path with 3 steps: origin (optional or required), middle, target
          const job = jobService.createJob({ name: 'Skip Test', goalQuantity: 1 })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Test Path',
            goalQuantity: 1,
            advancementMode: 'flexible',
            steps: [
              { name: 'Origin', optional: originOptional },
              { name: 'Middle', optional: false },
              { name: 'Target', optional: false },
            ],
          })

          const originStep = path.steps[0]
          const targetStep = path.steps[1]

          // Create a part at the origin step
          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test',
          )
          const partId = parts[0].id

          // Call advanceToStep with the skip flag
          const input: any = {
            targetStepId: targetStep.id,
            userId: 'user_test',
          }
          if (skipFlag !== undefined) {
            input.skip = skipFlag
          }

          lifecycleService.advanceToStep(partId, input)

          // Check origin step status
          const originStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, originStep.id)
          expect(originStatus).toBeTruthy()

          if (skipFlag === true) {
            if (originOptional) {
              // Optional + skip → 'skipped'
              expect(originStatus!.status).toBe('skipped')
            } else {
              // Required + skip → 'deferred'
              expect(originStatus!.status).toBe('deferred')
            }
          } else {
            // skip:false or omitted → 'completed'
            expect(originStatus!.status).toBe('completed')
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('skip:true with active override on required step marks origin as skipped', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          db = createTestDb()
          const { jobService, pathService, partService, lifecycleService, repos } = setupServices(db)

          // Create job + path with required origin step
          const job = jobService.createJob({ name: 'Override Test', goalQuantity: 1 })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Test Path',
            goalQuantity: 1,
            advancementMode: 'flexible',
            steps: [
              { name: 'Origin', optional: false },
              { name: 'Target', optional: false },
            ],
          })

          const originStep = path.steps[0]
          const targetStep = path.steps[1]

          // Create a part
          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test',
          )
          const partId = parts[0].id

          // Create an active override on the origin step
          lifecycleService.createStepOverride([partId], originStep.id, 'test override', 'user_test')

          // Advance with skip:true
          lifecycleService.advanceToStep(partId, {
            targetStepId: targetStep.id,
            userId: 'user_test',
            skip: true,
          })

          // Required step with active override + skip → 'skipped' (not 'deferred')
          const originStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, originStep.id)
          expect(originStatus).toBeTruthy()
          expect(originStatus!.status).toBe('skipped')

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
