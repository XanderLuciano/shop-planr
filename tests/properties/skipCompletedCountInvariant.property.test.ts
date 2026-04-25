/**
 * Property 8: Skip completedCount invariant
 *
 * skip:true → completedCount unchanged; skip:false/omitted → completedCount +1
 *
 * **Validates: Requirements 9.3, 9.4**
 */
import { describe, it, afterAll, beforeAll, expect } from 'vitest'
import fc from 'fast-check'
import type Database from 'better-sqlite3'
import { createMigratedDb, savepoint, rollback } from './helpers'
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

function setupServices(db: Database.Database) {
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

describe('Property 8: Skip completedCount invariant', () => {
  let db: Database.Database

  beforeAll(() => {
    db = createMigratedDb()
  })

  afterAll(() => {
    db?.close()
  })

  it('skip:true leaves completedCount unchanged; skip:false/omitted increments by 1', () => {
    fc.assert(
      fc.property(
        fc.record({
          skipFlag: fc.constantFrom(true, false, undefined),
          originOptional: fc.boolean(),
        }),
        ({ skipFlag, originOptional }) => {
          savepoint(db)
          try {
            const { jobService, pathService, partService, lifecycleService, repos } = setupServices(db)

            // Create job + path with 2 steps
            const job = jobService.createJob({ name: 'Count Test', goalQuantity: 1 })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Test Path',
              goalQuantity: 1,
              advancementMode: 'flexible',
              steps: [
                { name: 'Origin', optional: originOptional },
                { name: 'Target', optional: false },
              ],
            })

            const originStep = path.steps[0]
            const targetStep = path.steps[1]

            // Snapshot completedCount before
            const countBefore = repos.paths.getStepById(originStep.id)!.completedCount

            // Create a part
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 },
              'user_test',
            )
            const partId = parts[0].id

            // Advance with skip flag
            const input: any = {
              targetStepId: targetStep.id,
              userId: 'user_test',
            }
            if (skipFlag !== undefined) {
              input.skip = skipFlag
            }

            lifecycleService.advanceToStep(partId, input)

            // Check completedCount after
            const countAfter = repos.paths.getStepById(originStep.id)!.completedCount

            if (skipFlag === true) {
              // skip:true → completedCount unchanged
              expect(countAfter).toBe(countBefore)
            } else {
              // skip:false or omitted → completedCount +1
              expect(countAfter).toBe(countBefore + 1)
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
