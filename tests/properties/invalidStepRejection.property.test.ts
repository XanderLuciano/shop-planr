/**
 * Property 5: Invalid Step Rejection
 *
 * For any step ID that does not exist in the database, the step endpoint should
 * return a 404 error. Steps that exist but have zero active parts now return
 * a valid response with partCount: 0 (fixed behavior).
 *
 * **Validates: Requirements 2.6**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import type { WorkQueueJob, StepViewResponse } from '../../server/types/computed'

/**
 * Replicate the step endpoint lookup logic from
 * server/api/operator/step/[stepId].get.ts as a pure function.
 * Returns null only when the step ID does not exist in the database (maps to 404).
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

describe('Property 5: Invalid Step Rejection', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  it('returns null (404) for any non-existent step ID', () => {
    const nonExistentIdArb = fc.string({ minLength: 1, maxLength: 40 }).filter(s => s.trim().length > 0)

    fc.assert(
      fc.property(nonExistentIdArb, (fakeStepId) => {
        ctx = createTestContext()

        // Empty database — no jobs, paths, or steps exist
        const result = lookupStep(ctx, fakeStepId)
        expect(result).toBeNull()

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  it('returns valid response for step 0 with zero active parts (fixed behavior)', () => {
    const configArb = fc.record({
      jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      stepCount: fc.integer({ min: 2, max: 5 }),
      partCount: fc.integer({ min: 1, max: 6 }),
    })

    fc.assert(
      fc.property(configArb, (config) => {
        ctx = createTestContext()
        const { jobService, pathService, partService } = ctx

        // Create a job with a path and multiple steps
        const job = jobService.createJob({
          name: config.jobName,
          goalQuantity: config.partCount,
        })

        const steps = Array.from({ length: config.stepCount }, (_, i) => ({
          name: `Step-${i}`,
        }))

        const path = pathService.createPath({
          jobId: job.id,
          name: config.pathName,
          goalQuantity: config.partCount,
          steps,
        })

        // Create parts (they start at step 0)
        const parts = partService.batchCreateParts(
          { jobId: job.id, pathId: path.id, quantity: config.partCount },
          'user_test',
        )

        // Advance ALL parts past step 0 so step 0 has zero active parts
        for (const part of parts) {
          partService.advancePart(part.id, 'user_test')
        }

        // Step 0 now has zero active parts — fixed lookup returns valid response with partCount: 0
        const step0Id = path.steps[0].id
        const result = lookupStep(ctx, step0Id)
        expect(result, `Expected non-null for step 0 ${step0Id} with zero active parts`).not.toBeNull()
        expect(result!.job.partCount).toBe(0)
        expect(result!.job.partIds).toEqual([])
        expect(result!.job.stepOrder).toBe(0)

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })
})
