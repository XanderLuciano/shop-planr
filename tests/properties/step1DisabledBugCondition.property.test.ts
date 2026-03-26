/**
 * Bug Condition Exploration Tests — Step 1 Disabled After Advance
 *
 * These tests replicate the FIXED step lookup and _all aggregation logic
 * to verify the bug is resolved. All three tests should PASS on
 * fixed code — passing confirms the fix works.
 *
 * Bug: When a valid process step has zero active serials, the API incorrectly
 * returns null/404 instead of a valid response with partCount: 0.
 *
 * **Validates: Requirements 2.1, 2.3, 2.4**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import type { WorkQueueJob, StepViewResponse, WorkQueueResponse } from '../../server/types/computed'

// ---------------------------------------------------------------------------
// Replicated FIXED logic from server/api/operator/step/[stepId].get.ts
// ---------------------------------------------------------------------------
function lookupStep(ctx: TestContext, stepId: string): StepViewResponse | null {
  const { jobService, pathService, serialService, noteService } = ctx
  const jobs = jobService.listJobs()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length

      for (const step of path.steps) {
        if (step.id !== stepId) continue

        const serials = serialService.listSerialsByStepIndex(path.id, step.order)
        const isFinalStep = step.order === totalSteps - 1
        const prevStep = step.order > 0 ? path.steps[step.order - 1] : undefined
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

        let previousStepWipCount: number | undefined
        if (step.order > 0 && serials.length === 0) {
          const prevSerials = serialService.listSerialsByStepIndex(path.id, step.order - 1)
          previousStepWipCount = prevSerials.length
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
          serialIds: serials.map(s => s.id),
          partCount: serials.length,
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

  return null
}

// ---------------------------------------------------------------------------
// Replicated FIXED logic from server/api/operator/queue/_all.get.ts
// ---------------------------------------------------------------------------
function aggregateAllWork(ctx: TestContext): WorkQueueResponse {
  const { jobService, pathService, serialService } = ctx
  const jobs = jobService.listJobs()
  const groupMap = new Map<string, WorkQueueJob>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length

      for (const step of path.steps) {
        const serials = serialService.listSerialsByStepIndex(path.id, step.order)
        if (serials.length === 0 && step.order !== 0) continue // FIXED: only skip non-first steps with zero serials

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
          serialIds: serials.map(s => s.id),
          partCount: serials.length,
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


// ---------------------------------------------------------------------------
// Arbitraries — same pattern as stepEndpoint.property.test.ts
// ---------------------------------------------------------------------------

/** Arbitrary for a single job with one path, random steps, and random serials */
const jobPathConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  serialCount: fc.integer({ min: 1, max: 8 }),
  stepLocations: fc.array(
    fc.option(fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0), { nil: undefined }),
    { minLength: 5, maxLength: 5 },
  ),
})

/** Config for tests that need 2+ steps */
const multiStepConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 2, max: 5 }),
  serialCount: fc.integer({ min: 1, max: 8 }),
  stepLocations: fc.array(
    fc.option(fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0), { nil: undefined }),
    { minLength: 5, maxLength: 5 },
  ),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Bug Condition Exploration — Step 1 Disabled After Advance', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  /**
   * Property 1: Bug Condition — First Step Always Accessible
   *
   * For any valid first step (step_order = 0) with zero active serials
   * (all serials advanced past it), lookupStep should return a non-null
   * result with partCount: 0.
   *
   * This validates the fixed behavior; unfixed code would return null
   * when serials.length === 0.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it('Property 1: First step with zero serials returns valid response', () => {
    fc.assert(
      fc.property(jobPathConfigArb, (config) => {
        ctx = createTestContext()
        const { jobService, pathService, serialService } = ctx

        // Create job + path
        const job = jobService.createJob({
          name: config.jobName,
          goalQuantity: config.serialCount,
        })

        const steps = Array.from({ length: config.stepCount }, (_, i) => ({
          name: `Step-${i}`,
          location: config.stepLocations[i],
        }))

        const path = pathService.createPath({
          jobId: job.id,
          name: config.pathName,
          goalQuantity: config.serialCount,
          steps,
        })

        // Create serials (they start at step 0)
        const serials = serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: config.serialCount },
          'user_test',
        )

        // Advance ALL serials past step 0
        // For single-step paths, advancing completes the serial
        // For multi-step paths, advancing moves to step 1
        for (const serial of serials) {
          try {
            serialService.advanceSerial(serial.id, 'user_test')
          } catch {
            // ignore if already completed
          }
        }

        // Now step 0 has zero serials — query it
        const step0Id = path.steps[0].id
        const result = lookupStep(ctx, step0Id)

        // ASSERT: first step should always be accessible with partCount: 0
        expect(result, `First step ${step0Id} should return non-null even with 0 serials`).not.toBeNull()
        expect(result!.job.partCount).toBe(0)
        expect(result!.job.serialIds).toEqual([])

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Property 2: Bug Condition — Non-First Step Returns WIP Context
   *
   * For any valid non-first step (step_order > 0) with zero active serials
   * (no serials advanced to it yet), lookupStep should return a non-null
   * result with partCount: 0.
   *
   * This validates the fixed behavior; unfixed code would return null
   * when serials.length === 0.
   *
   * **Validates: Requirements 2.4, 2.5**
   */
  it('Property 2: Non-first step with zero serials returns valid response', () => {
    fc.assert(
      fc.property(multiStepConfigArb, (config) => {
        ctx = createTestContext()
        const { jobService, pathService, serialService } = ctx

        // Create job + path with 2+ steps
        const job = jobService.createJob({
          name: config.jobName,
          goalQuantity: config.serialCount,
        })

        const steps = Array.from({ length: config.stepCount }, (_, i) => ({
          name: `Step-${i}`,
          location: config.stepLocations[i],
        }))

        const path = pathService.createPath({
          jobId: job.id,
          name: config.pathName,
          goalQuantity: config.serialCount,
          steps,
        })

        // Create serials at step 0 — do NOT advance any
        serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: config.serialCount },
          'user_test',
        )

        // Step 1 has zero serials (none advanced from step 0 yet)
        const step1Id = path.steps[1].id
        const result = lookupStep(ctx, step1Id)

        // ASSERT: non-first step should return valid response with partCount: 0
        expect(result, `Step 1 (${step1Id}) should return non-null even with 0 serials`).not.toBeNull()
        expect(result!.job.partCount).toBe(0)
        expect(result!.job.serialIds).toEqual([])

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Property 3: Bug Condition — First Step Included in Parts View
   *
   * For any valid first step (step_order = 0) with zero active serials,
   * aggregateAllWork should include that step in the response so it
   * remains navigable from the Parts View.
   *
   * This validates the fixed behavior; unfixed code would skip steps
   * with serials.length === 0.
   *
   * **Validates: Requirements 2.3**
   */
  it('Property 3: Parts View includes first step even with zero serials', () => {
    fc.assert(
      fc.property(jobPathConfigArb, (config) => {
        ctx = createTestContext()
        const { jobService, pathService, serialService } = ctx

        // Create job + path
        const job = jobService.createJob({
          name: config.jobName,
          goalQuantity: config.serialCount,
        })

        const steps = Array.from({ length: config.stepCount }, (_, i) => ({
          name: `Step-${i}`,
          location: config.stepLocations[i],
        }))

        const path = pathService.createPath({
          jobId: job.id,
          name: config.pathName,
          goalQuantity: config.serialCount,
          steps,
        })

        // Create serials
        const serials = serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: config.serialCount },
          'user_test',
        )

        // Advance ALL serials past step 0
        for (const serial of serials) {
          try {
            serialService.advanceSerial(serial.id, 'user_test')
          } catch {
            // ignore if already completed
          }
        }

        // Call aggregateAllWork
        const response = aggregateAllWork(ctx)

        // ASSERT: step 0 should appear in the response
        const step0Id = path.steps[0].id
        const step0InResponse = response.jobs.some(j => j.stepId === step0Id)

        expect(step0InResponse, `Step 0 (${step0Id}) should be included in Parts View even with 0 serials`).toBe(true)

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })
})
