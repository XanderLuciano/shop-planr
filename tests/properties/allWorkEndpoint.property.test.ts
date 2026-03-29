/**
 * Property 1: All-Work Endpoint Completeness
 *
 * For any set of jobs, each with paths containing ordered process steps and
 * parts at various steps, the all-work endpoint should return a WorkQueueJob
 * entry for every step that has at least one active part. Each entry should
 * contain the correct partCount, stepName, stepLocation, pathName, jobName,
 * and partIds.
 *
 * **Validates: Requirements 1.2, 1.3**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import type { WorkQueueJob, WorkQueueResponse } from '../../server/types/computed'

/**
 * Replicate the aggregation logic from server/api/operator/queue/_all.get.ts
 * as a pure function operating on the test context services.
 */
function aggregateAllWork(ctx: TestContext): WorkQueueResponse {
  const { jobService, pathService, partService } = ctx
  const jobs = jobService.listJobs()
  const groupMap = new Map<string, WorkQueueJob>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length

      for (const step of path.steps) {
        const parts = partService.listPartsByStepIndex(path.id, step.order)
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
          partIds: parts.map((s) => s.id),
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

  return { operatorId: '_all', jobs: queueJobs, totalParts }
}

/** Arbitrary for a single job with one path, random steps, and random parts */
const jobPathConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  partCount: fc.integer({ min: 0, max: 8 }),
  stepLocations: fc.array(
    fc.option(
      fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0),
      { nil: undefined }
    ),
    { minLength: 5, maxLength: 5 }
  ),
  advancementSpecs: fc.array(
    fc.record({
      partIndex: fc.integer({ min: 0, max: 7 }),
      advanceTimes: fc.integer({ min: 0, max: 6 }),
    }),
    { minLength: 0, maxLength: 10 }
  ),
})

/** Generate 1-3 job/path configs for a multi-job scenario */
const scenarioArb = fc.array(jobPathConfigArb, { minLength: 1, maxLength: 3 })

describe('Property 1: All-Work Endpoint Completeness', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  it('returns a WorkQueueJob for every step with active parts, with correct metadata', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        ctx = createTestContext()
        const { jobService, pathService, partService } = ctx

        // Track expected state: which parts are at which step
        const expectedParts: Array<{
          id: string
          jobId: string
          jobName: string
          pathId: string
          pathName: string
          currentStepIndex: number
        }> = []

        // Track step metadata for verification
        const stepMeta: Map<
          string,
          {
            stepName: string
            stepLocation?: string
            pathName: string
            jobName: string
            totalSteps: number
          }
        > = new Map()

        for (const config of configs) {
          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: Math.max(config.partCount, 1),
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step-${i}`,
            location: config.stepLocations[i],
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: Math.max(config.partCount, 1),
            steps,
          })

          // Record step metadata for later verification
          for (const step of path.steps) {
            const key = `${job.id}|${path.id}|${step.order}`
            stepMeta.set(key, {
              stepName: step.name,
              stepLocation: step.location,
              pathName: path.name,
              jobName: job.name,
              totalSteps: path.steps.length,
            })
          }

          if (config.partCount === 0) continue

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: config.partCount },
            'user_test'
          )

          // All parts start at step 0
          for (const s of parts) {
            expectedParts.push({
              id: s.id,
              jobId: job.id,
              jobName: job.name,
              pathId: path.id,
              pathName: path.name,
              currentStepIndex: 0,
            })
          }

          // Apply advancements
          for (const spec of config.advancementSpecs) {
            if (spec.partIndex >= parts.length) continue
            const part = parts[spec.partIndex]
            const tracked = expectedParts.find((t) => t.id === part.id)!

            for (let i = 0; i < spec.advanceTimes; i++) {
              if (tracked.currentStepIndex === -1) break
              try {
                partService.advancePart(part.id, 'user_test')
                if (tracked.currentStepIndex === config.stepCount - 1) {
                  tracked.currentStepIndex = -1 // completed
                } else {
                  tracked.currentStepIndex += 1
                }
              } catch {
                break
              }
            }
          }
        }

        // Run the aggregation
        const response = aggregateAllWork(ctx)

        // Build expected groups: step key → set of active part IDs
        const expectedGroups = new Map<string, Set<string>>()
        for (const s of expectedParts) {
          if (s.currentStepIndex < 0) continue // completed/scrapped
          const key = `${s.jobId}|${s.pathId}|${s.currentStepIndex}`
          if (!expectedGroups.has(key)) expectedGroups.set(key, new Set())
          expectedGroups.get(key)!.add(s.id)
        }

        // 1. Every step with active parts has a corresponding WorkQueueJob
        for (const [key, partIds] of expectedGroups) {
          const entry = response.jobs.find((j) => {
            const entryKey = `${j.jobId}|${j.pathId}|${j.stepOrder}`
            return entryKey === key
          })
          expect(entry, `Missing WorkQueueJob for group ${key}`).toBeDefined()
        }

        // 2. No extra entries — response only contains steps with active parts
        expect(response.jobs.length).toBe(expectedGroups.size)

        // 3. Each entry has correct partCount and partIds
        for (const entry of response.jobs) {
          const key = `${entry.jobId}|${entry.pathId}|${entry.stepOrder}`
          const expectedIds = expectedGroups.get(key)!

          expect(entry.partCount).toBe(expectedIds.size)
          expect(entry.partIds.length).toBe(expectedIds.size)
          for (const sid of entry.partIds) {
            expect(expectedIds.has(sid)).toBe(true)
          }
        }

        // 4. Each entry has correct metadata (stepName, stepLocation, pathName, jobName)
        for (const entry of response.jobs) {
          const key = `${entry.jobId}|${entry.pathId}|${entry.stepOrder}`
          const meta = stepMeta.get(key)!

          expect(entry.stepName).toBe(meta.stepName)
          expect(entry.stepLocation).toBe(meta.stepLocation)
          expect(entry.pathName).toBe(meta.pathName)
          expect(entry.jobName).toBe(meta.jobName)
          expect(entry.totalSteps).toBe(meta.totalSteps)
        }

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 }
    )
  })
})
