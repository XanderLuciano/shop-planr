/**
 * Property 9: canComplete ignores optional steps and blocks on deferred required steps
 *
 * Optional steps excluded regardless of status; required 'deferred' blocks;
 * required 'waived' does not block.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3**
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

describe('Property 9: canComplete ignores optional steps and blocks on deferred required steps', () => {
  let db: InstanceType<typeof Database>

  afterEach(() => {
    if (db) db.close()
  })

  it('optional steps never block completion regardless of status', () => {
    fc.assert(
      fc.property(
        fc.record({
          optionalStatus: fc.constantFrom('skipped' as const, 'pending' as const, 'in_progress' as const, 'deferred' as const),
        }),
        ({ optionalStatus }) => {
          db = createTestDb()
          const { jobService, pathService, partService, lifecycleService, repos } = setupServices(db)

          // Path: required step (completed) + optional step (various statuses)
          const job = jobService.createJob({ name: 'Optional Test', goalQuantity: 1 })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Test Path',
            goalQuantity: 1,
            advancementMode: 'flexible',
            steps: [
              { name: 'Required', optional: false },
              { name: 'Optional', optional: true },
            ],
          })

          const requiredStep = path.steps[0]
          const optionalStep = path.steps[1]

          // Create a part
          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test',
          )
          const partId = parts[0].id

          // Mark required step as completed
          repos.partStepStatuses.updateLatestByPartAndStep(partId, requiredStep.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })

          // Set optional step to the test status
          repos.partStepStatuses.updateLatestByPartAndStep(partId, optionalStep.id, {
            status: optionalStatus,
            updatedAt: new Date().toISOString(),
          })

          // canComplete should succeed — optional steps are excluded
          const result = lifecycleService.canComplete(partId)
          expect(result.canComplete).toBe(true)
          expect(result.blockers).not.toContain(optionalStep.id)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('required deferred step blocks completion', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          db = createTestDb()
          const { jobService, pathService, partService, lifecycleService } = setupServices(db)

          // Path: 2 required steps, advance past first to second, skip first → deferred
          const job = jobService.createJob({ name: 'Deferred Block Test', goalQuantity: 1 })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Test Path',
            goalQuantity: 1,
            advancementMode: 'flexible',
            steps: [
              { name: 'Step A', optional: false },
              { name: 'Step B', optional: false },
              { name: 'Step C', optional: false },
            ],
          })

          const stepA = path.steps[0]
          const stepC = path.steps[2]

          // Create a part at step A
          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test',
          )
          const partId = parts[0].id

          // Skip from step A to step C (step A becomes deferred, step B becomes deferred)
          lifecycleService.advanceToStep(partId, {
            targetStepId: stepC.id,
            userId: 'user_test',
            skip: true,
          })

          // canComplete should fail — step A is deferred (required)
          const result = lifecycleService.canComplete(partId)
          expect(result.canComplete).toBe(false)
          expect(result.blockers).toContain(stepA.id)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('required waived step does not block completion', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          db = createTestDb()
          const { jobService, pathService, partService, lifecycleService, repos } = setupServices(db)

          // Path: 3 required steps
          const job = jobService.createJob({ name: 'Waived Test', goalQuantity: 1 })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Test Path',
            goalQuantity: 1,
            advancementMode: 'flexible',
            steps: [
              { name: 'Step A', optional: false },
              { name: 'Step B', optional: false },
              { name: 'Step C', optional: false },
            ],
          })

          const stepA = path.steps[0]
          const stepB = path.steps[1]
          const stepC = path.steps[2]

          // Create a part at step A
          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user_test',
          )
          const partId = parts[0].id

          // Skip from step A to step C (step A → deferred, step B → deferred)
          lifecycleService.advanceToStep(partId, {
            targetStepId: stepC.id,
            userId: 'user_test',
            skip: true,
          })

          // Waive both deferred steps
          lifecycleService.waiveStep(partId, stepA.id, {
            reason: 'approved by supervisor',
            approverId: 'admin_user',
          })
          lifecycleService.waiveStep(partId, stepB.id, {
            reason: 'approved by supervisor',
            approverId: 'admin_user',
          })

          // Mark step C as completed
          repos.partStepStatuses.updateLatestByPartAndStep(partId, stepC.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })

          // canComplete should succeed — waived steps don't block
          const result = lifecycleService.canComplete(partId)
          expect(result.canComplete).toBe(true)
          expect(result.blockers.length).toBe(0)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
