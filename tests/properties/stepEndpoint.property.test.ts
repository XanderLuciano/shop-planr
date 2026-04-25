/**
 * Property 4: Step Endpoint Correctness
 *
 * For any valid step ID that has active parts, the step endpoint should return
 * a WorkQueueJob with: the correct stepId, stepOrder, stepName, and stepLocation
 * matching the process step; the correct jobId, jobName, pathId, and pathName
 * matching the parent path and job; partIds containing exactly the IDs of all
 * active parts at that step; and partCount equal to the length of partIds.
 *
 * **Validates: Requirements 2.3, 3.1, 3.5**
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import type { WorkQueueJob, StepViewResponse } from '../../server/types/computed'

/**
 * Replicate the step endpoint lookup logic from
 * server/api/operator/step/[stepId].get.ts as a pure function.
 */
function lookupStep(ctx: TestContext, stepId: string): StepViewResponse | null {
  const { jobService, pathService, partService, noteService } = ctx
  const jobs = jobService.listJobs()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length

      for (const step of path.steps) {
        if (step.id !== stepId) continue

        const parts = partService.listPartsByCurrentStepId(step.id)

        const isFinalStep = step.order === totalSteps - 1
        const prevStep = step.order > 0 ? path.steps[step.order - 1] : undefined
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

        let previousStepWipCount: number | undefined
        if (step.order > 0 && parts.length === 0) {
          const prevParts = partService.listPartsByCurrentStepId(prevStep!.id)
          previousStepWipCount = prevParts.length
        }

        const foundJob: WorkQueueJob = {
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
          previousStepId: prevStep?.id,
          previousStepName: prevStep?.name,
          nextStepId: nextStep?.id,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep,
          assignedTo: step.assignedTo,
        }

        const notes = noteService.getNotesForStep(stepId)
        return {
          job: foundJob,
          notes,
          ...(previousStepWipCount !== undefined && { previousStepWipCount }),
        }
      }
    }
  }

  return null // step not found → 404
}

/** Arbitrary for a single job with one path, random steps, and random parts */
const jobPathConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  partCount: fc.integer({ min: 1, max: 8 }),
  stepLocations: fc.array(
    fc.option(fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0), { nil: undefined }),
    { minLength: 5, maxLength: 5 },
  ),
  advancementSpecs: fc.array(
    fc.record({
      partIndex: fc.integer({ min: 0, max: 7 }),
      advanceTimes: fc.integer({ min: 0, max: 4 }),
    }),
    { minLength: 0, maxLength: 8 },
  ),
  /** Index of the step to query (clamped to stepCount at runtime) */
  targetStepIndex: fc.integer({ min: 0, max: 4 }),
})

/** Generate 1-3 job/path configs; we'll pick one step from the first config */
const scenarioArb = fc.array(jobPathConfigArb, { minLength: 1, maxLength: 3 })

describe('Property 4: Step Endpoint Correctness', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('returns correct WorkQueueJob for any step with active parts', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        savepoint(ctx.db)
        try {
          const { jobService, pathService, partService } = ctx

          // Track created step IDs and part positions
          interface StepRecord {
            stepId: string
            stepOrder: number
            stepName: string
            stepLocation?: string
            jobId: string
            jobName: string
            pathId: string
            pathName: string
            totalSteps: number
          }

          interface TrackedPart {
            id: string
            pathId: string
            currentStepOrder: number // -1 = completed
          }

          const allStepRecords: StepRecord[] = []
          const allTrackedParts: TrackedPart[] = []

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

            // Record step metadata
            for (const step of path.steps) {
              allStepRecords.push({
                stepId: step.id,
                stepOrder: step.order,
                stepName: step.name,
                stepLocation: step.location,
                jobId: job.id,
                jobName: job.name,
                pathId: path.id,
                pathName: path.name,
                totalSteps: path.steps.length,
              })
            }

            // Create parts
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: config.partCount },
              'user_test',
            )

            for (const s of parts) {
              allTrackedParts.push({
                id: s.id,
                pathId: path.id,
                currentStepOrder: 0,
              })
            }

            // Apply advancements
            for (const spec of config.advancementSpecs) {
              if (spec.partIndex >= parts.length) continue
              const part = parts[spec.partIndex]
              const tracked = allTrackedParts.find(t => t.id === part.id)!

              for (let i = 0; i < spec.advanceTimes; i++) {
                if (tracked.currentStepOrder === -1) break
                try {
                  partService.advancePart(part.id, 'user_test')
                  if (tracked.currentStepOrder === config.stepCount - 1) {
                    tracked.currentStepOrder = -1 // completed
                  } else {
                    tracked.currentStepOrder += 1
                  }
                } catch {
                  break
                }
              }
            }
          }

          // Find steps that have active parts
          const stepsWithActiveParts = allStepRecords.filter((rec) => {
            return allTrackedParts.some(
              s => s.pathId === rec.pathId && s.currentStepOrder === rec.stepOrder,
            )
          })

          // If no steps have active parts, skip this iteration
          if (stepsWithActiveParts.length === 0) return

          // Pick a target step from the first config (clamped)
          const targetIdx = configs[0].targetStepIndex % stepsWithActiveParts.length
          const targetStep = stepsWithActiveParts[targetIdx]

          // Call the replicated lookup
          const result = lookupStep(ctx, targetStep.stepId)

          // The step has active parts, so result must not be null
          expect(result, `Expected non-null result for step ${targetStep.stepId}`).not.toBeNull()
          const { job } = result!

          // Verify step fields
          expect(job.stepId).toBe(targetStep.stepId)
          expect(job.stepOrder).toBe(targetStep.stepOrder)
          expect(job.stepName).toBe(targetStep.stepName)
          expect(job.stepLocation).toBe(targetStep.stepLocation)

          // Verify parent path and job fields
          expect(job.jobId).toBe(targetStep.jobId)
          expect(job.jobName).toBe(targetStep.jobName)
          expect(job.pathId).toBe(targetStep.pathId)
          expect(job.pathName).toBe(targetStep.pathName)
          expect(job.totalSteps).toBe(targetStep.totalSteps)

          // Verify partIds contains exactly the active parts at this step
          const expectedPartIds = allTrackedParts
            .filter(s => s.pathId === targetStep.pathId && s.currentStepOrder === targetStep.stepOrder)
            .map(s => s.id)

          expect(job.partIds.length).toBe(expectedPartIds.length)
          expect(new Set(job.partIds)).toEqual(new Set(expectedPartIds))

          // Verify partCount equals partIds length
          expect(job.partCount).toBe(job.partIds.length)

          // Verify isFinalStep and next step info
          const isFinalStep = targetStep.stepOrder === targetStep.totalSteps - 1
          expect(job.isFinalStep).toBe(isFinalStep)

          if (isFinalStep) {
            expect(job.nextStepName).toBeUndefined()
            expect(job.nextStepLocation).toBeUndefined()
          }
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 100 },
    )
  })
})
