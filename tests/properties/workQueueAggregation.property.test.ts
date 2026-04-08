/**
 * Property 1: Queue aggregation correctness
 *
 * For any set of jobs, paths, and parts where some parts have
 * currentStepId !== null, the work queue aggregation returns WorkQueueJob
 * entries whose partIds collectively contain exactly all active part IDs,
 * each in exactly one group matching its pathId and currentStepId.
 * First-step entries with partCount === 0 are also included when the
 * first active step has completedCount < goalQuantity.
 *
 * **Validates: Requirements 10.1, 9.3**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import type { WorkQueueJob, WorkQueueResponse } from '../../server/types/computed'
import { findFirstActiveStep, shouldIncludeStep } from '../../server/utils/workQueueHelpers'

/**
 * Replicate the aggregation logic from server/api/operator/queue/_all.get.ts
 * as a pure function that takes a test context and returns WorkQueueResponse.
 */
function aggregateWorkQueue(ctx: TestContext): WorkQueueResponse {
  const { jobService, pathService, partService } = ctx
  const jobs = jobService.listJobs()
  const groupMap = new Map<string, WorkQueueJob>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length
      const firstActiveStep = findFirstActiveStep(path.steps)

      for (const step of path.steps) {
        if (step.removedAt) continue

        const parts = partService.listPartsByCurrentStepId(step.id)
        const isFirstActive = firstActiveStep != null && step.id === firstActiveStep.id

        if (!shouldIncludeStep(step, parts.length, isFirstActive, path.goalQuantity)) continue

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
          assignedTo: step.assignedTo,
          jobPriority: job.priority,
          ...(isFirstActive && { goalQuantity: path.goalQuantity, completedCount: step.completedCount }),
        })
      }
    }
  }

  const queueJobs = Array.from(groupMap.values())
  const totalParts = queueJobs.reduce((sum, j) => sum + j.partCount, 0)

  return { jobs: queueJobs, totalParts }
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
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  it('all active part IDs appear exactly once across WorkQueueJob.partIds, each in the correct group', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        ctx = createTestContext()
        const { jobService, pathService, partService } = ctx

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
        const response = aggregateWorkQueue(ctx)

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

        // 2. Part count matches (excluding first-step entries with 0 parts)
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

        // 5. First-step entries with 0 parts have goalQuantity set
        for (const job of response.jobs) {
          if (job.partCount === 0) {
            expect(job.goalQuantity).toBeDefined()
          }
        }

        ctx.cleanup()
        ctx = null as any
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
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  it('partCount === partIds.length, stepName/stepId non-empty, totalParts === sum(partCount), grouping uniqueness', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        ctx = createTestContext()
        const { jobService, pathService, partService } = ctx

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
        const response = aggregateWorkQueue(ctx)

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

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })
})
