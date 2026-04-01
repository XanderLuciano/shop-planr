/**
 * Property 1: Queue aggregation correctness
 *
 * For any set of jobs, paths, and parts where some parts have
 * currentStepId !== null, the work queue aggregation returns WorkQueueJob
 * entries whose partIds collectively contain exactly all active part IDs,
 * each in exactly one group matching its pathId and currentStepId.
 *
 * **Validates: Requirements 1.1, 3.2**
 */
import { describe, it, afterEach, expect } from 'vitest'
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
import type { WorkQueueJob, WorkQueueResponse } from '../../server/types/computed'

const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
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

  return { jobService, pathService, partService }
}

/**
 * Replicate the aggregation logic from server/api/operator/queue/[userId].get.ts
 * as a pure function that takes services and returns WorkQueueResponse.
 */
function aggregateWorkQueue(
  services: ReturnType<typeof setupServices>,
  userId: string,
): WorkQueueResponse {
  const { jobService, pathService, partService } = services
  const jobs = jobService.listJobs()
  const groupMap = new Map<string, WorkQueueJob>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length

      for (const step of path.steps) {
        const parts = partService.listPartsByCurrentStepId(step.id)
        if (parts.length === 0) continue

        const key = `${job.id}|${path.id}|${step.order}`
        const isFinalStep = step.order === totalSteps - 1
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

        groupMap.set(key, {
          jobId: job.id,
          jobName: job.name,
          pathId: path.id,
          pathName: path.name,
          stepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          stepLocation: step.location,
          totalSteps,
          partIds: parts.map(s => s.id),
          partCount: parts.length,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep,
        })
      }
    }
  }

  const queueJobs = Array.from(groupMap.values())
  const totalParts = queueJobs.reduce((sum, j) => sum + j.partCount, 0)

  return { operatorId: userId, jobs: queueJobs, totalParts }
}

/** Arbitrary for a single job/path/part configuration */
const jobPathConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  partCount: fc.integer({ min: 0, max: 8 }),
  /** How many parts to advance (and by how many steps each) */
  advancementSpecs: fc.array(
    fc.record({
      /** Index into the parts array for this path */
      partIndex: fc.integer({ min: 0, max: 7 }),
      /** How many times to advance this part */
      advanceTimes: fc.integer({ min: 0, max: 6 }),
    }),
    { minLength: 0, maxLength: 10 },
  ),
})

/** Generate 1-3 job/path configs to create a realistic multi-job scenario */
const scenarioArb = fc.array(jobPathConfigArb, { minLength: 1, maxLength: 3 })

describe('Property 1: Queue aggregation correctness', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) {
      db.close()
      db = null as any
    }
  })

  it('all active part IDs appear exactly once across WorkQueueJob.partIds, each in the correct group', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        db = createTestDb()
        const services = setupServices(db)
        const { jobService, pathService, partService } = services

        // Track all created parts with their expected state
        const allParts: Array<{
          id: string
          pathId: string
          currentStepOrder: number
        }> = []

        for (const config of configs) {
          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: Math.max(config.partCount, 1),
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step ${i}`,
            location: i % 2 === 0 ? `Loc-${i}` : undefined,
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: Math.max(config.partCount, 1),
            steps,
          })

          if (config.partCount === 0) continue

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: config.partCount },
            'user_test',
          )

          // Initialize tracking — all start at step 0
          for (const s of parts) {
            allParts.push({ id: s.id, pathId: path.id, currentStepOrder: 0 })
          }

          // Apply advancements
          for (const spec of config.advancementSpecs) {
            if (spec.partIndex >= parts.length) continue
            const part = parts[spec.partIndex]
            const tracked = allParts.find(t => t.id === part.id)!

            for (let i = 0; i < spec.advanceTimes; i++) {
              if (tracked.currentStepOrder === -1) break // already completed
              try {
                partService.advancePart(part.id, 'user_test')
                if (tracked.currentStepOrder === config.stepCount - 1) {
                  tracked.currentStepOrder = -1 // completed
                } else {
                  tracked.currentStepOrder += 1
                }
              } catch {
                break // already completed or error
              }
            }
          }
        }

        // Run aggregation
        const response = aggregateWorkQueue(services, 'user_test')

        // Collect all active parts (currentStepId !== null)
        const expectedActiveIds = new Set(
          allParts
            .filter(s => s.currentStepOrder >= 0)
            .map(s => s.id),
        )

        // Collect all part IDs from the response
        const actualIds: string[] = []
        for (const job of response.jobs) {
          actualIds.push(...job.partIds)
        }
        const actualIdSet = new Set(actualIds)

        // 1. Every active part appears in the response
        for (const expectedId of expectedActiveIds) {
          expect(actualIdSet.has(expectedId)).toBe(true)
        }

        // 2. No extra parts in the response (no completed parts)
        expect(actualIds.length).toBe(expectedActiveIds.size)

        // 3. No duplicates — each part appears exactly once
        expect(actualIdSet.size).toBe(actualIds.length)

        // 4. Each part is in the correct group (matching pathId and stepOrder)
        for (const job of response.jobs) {
          for (const partId of job.partIds) {
            const tracked = allParts.find(t => t.id === partId)!
            expect(tracked.pathId).toBe(job.pathId)
            expect(tracked.currentStepOrder).toBe(job.stepOrder)
          }
        }

        db.close()
        db = null as any
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 2: Queue structural invariants
 *
 * For any WorkQueueResponse, the following must hold:
 * (a) each WorkQueueJob has partCount equal to partIds.length,
 * (b) each job has a non-empty stepName and stepId,
 * (c) totalParts equals the sum of all partCount values across all jobs,
 * (d) jobs are grouped by the combination of jobId + pathId + stepOrder.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4**
 */
describe('Property 2: Queue structural invariants', () => {
  let db: ReturnType<typeof createTestDb>

  afterEach(() => {
    if (db) {
      db.close()
      db = null as any
    }
  })

  it('partCount === partIds.length, stepName/stepId non-empty, totalParts === sum(partCount), grouping uniqueness', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        db = createTestDb()
        const services = setupServices(db)
        const { jobService, pathService, partService } = services

        for (const config of configs) {
          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: Math.max(config.partCount, 1),
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step ${i}`,
            location: i % 2 === 0 ? `Loc-${i}` : undefined,
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: Math.max(config.partCount, 1),
            steps,
          })

          if (config.partCount === 0) continue

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: config.partCount },
            'user_test',
          )

          // Apply advancements
          for (const spec of config.advancementSpecs) {
            if (spec.partIndex >= parts.length) continue
            const part = parts[spec.partIndex]
            for (let i = 0; i < spec.advanceTimes; i++) {
              try {
                partService.advancePart(part.id, 'user_test')
              } catch {
                break
              }
            }
          }
        }

        // Run aggregation
        const response = aggregateWorkQueue(services, 'user_test')

        // (a) partCount === partIds.length for every job
        for (const job of response.jobs) {
          expect(job.partCount).toBe(job.partIds.length)
        }

        // (b) stepName and stepId are non-empty for every job
        for (const job of response.jobs) {
          expect(job.stepName.length).toBeGreaterThan(0)
          expect(job.stepId.length).toBeGreaterThan(0)
        }

        // (c) totalParts === sum of all partCount values
        const sumPartCount = response.jobs.reduce((sum, j) => sum + j.partCount, 0)
        expect(response.totalParts).toBe(sumPartCount)

        // (d) No two jobs share the same jobId + pathId + stepOrder combination
        const groupKeys = response.jobs.map(j => `${j.jobId}|${j.pathId}|${j.stepOrder}`)
        const uniqueKeys = new Set(groupKeys)
        expect(uniqueKeys.size).toBe(groupKeys.length)

        db.close()
        db = null as any
      }),
      { numRuns: 100 },
    )
  })
})
