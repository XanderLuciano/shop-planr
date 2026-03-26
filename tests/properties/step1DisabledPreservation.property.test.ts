/**
 * Preservation Property Tests — Step 1 Disabled After Advance
 *
 * These tests verify baseline behavior that MUST be preserved after the fix.
 * They run against the UNFIXED lookupStep logic and MUST PASS on current code.
 *
 * Property 4: Steps with active serials return correct WorkQueueJob data
 * Property 5: Invalid (non-existent) step IDs return null (404)
 *
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import type { WorkQueueJob, StepViewResponse } from '../../server/types/computed'

// ---------------------------------------------------------------------------
// Replicated UNFIXED logic from server/api/operator/step/[stepId].get.ts
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
        if (serials.length === 0) return null // BUG: returns null for zero serials

        const isFinalStep = step.order === totalSteps - 1
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

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
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep,
        }

        const notes = noteService.getNotesForStep(stepId)
        return { job: foundJob, notes }
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Arbitraries — same pattern as stepEndpoint.property.test.ts
// ---------------------------------------------------------------------------

/** Arbitrary for a single job with one path, random steps, and random serials with advancements */
const jobPathConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 5 }),
  serialCount: fc.integer({ min: 1, max: 8 }),
  stepLocations: fc.array(
    fc.option(fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0), { nil: undefined }),
    { minLength: 5, maxLength: 5 },
  ),
  advancementSpecs: fc.array(
    fc.record({
      serialIndex: fc.integer({ min: 0, max: 7 }),
      advanceTimes: fc.integer({ min: 0, max: 4 }),
    }),
    { minLength: 0, maxLength: 8 },
  ),
  targetStepIndex: fc.integer({ min: 0, max: 4 }),
})

/** Generate 1-3 job/path configs */
const scenarioArb = fc.array(jobPathConfigArb, { minLength: 1, maxLength: 3 })

/** Arbitrary for random non-existent step IDs */
const fakeStepIdArb = fc.stringMatching(/^step_[A-Za-z0-9]{8,12}$/)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Preservation — Step 1 Disabled After Advance', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  /**
   * Property 4: Preservation — Steps With Active Serials Unchanged
   *
   * For any valid step that has active serials (serials.length > 0),
   * the unfixed lookupStep returns a non-null result with correct metadata.
   * This behavior MUST be preserved after the fix.
   *
   * **Validates: Requirements 3.2, 3.4**
   */
  it('Property 4: Active serial steps return correct WorkQueueJob (MUST PASS)', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        ctx = createTestContext()
        const { jobService, pathService, serialService } = ctx

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

        interface TrackedSerial {
          id: string
          pathId: string
          currentStepIndex: number // -1 = completed
        }

        const allStepRecords: StepRecord[] = []
        const allTrackedSerials: TrackedSerial[] = []

        for (const config of configs) {
          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: Math.max(config.serialCount, 1),
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step-${i}`,
            location: config.stepLocations[i],
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: Math.max(config.serialCount, 1),
            steps,
          })

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

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: config.serialCount },
            'user_test',
          )

          for (const s of serials) {
            allTrackedSerials.push({
              id: s.id,
              pathId: path.id,
              currentStepIndex: 0,
            })
          }

          // Apply advancements
          for (const spec of config.advancementSpecs) {
            if (spec.serialIndex >= serials.length) continue
            const serial = serials[spec.serialIndex]
            const tracked = allTrackedSerials.find(t => t.id === serial.id)!

            for (let i = 0; i < spec.advanceTimes; i++) {
              if (tracked.currentStepIndex === -1) break
              try {
                serialService.advanceSerial(serial.id, 'user_test')
                if (tracked.currentStepIndex === config.stepCount - 1) {
                  tracked.currentStepIndex = -1
                } else {
                  tracked.currentStepIndex += 1
                }
              } catch {
                break
              }
            }
          }
        }

        // Find steps that have active serials (serials.length > 0)
        const stepsWithActiveSerials = allStepRecords.filter((rec) => {
          return allTrackedSerials.some(
            s => s.pathId === rec.pathId && s.currentStepIndex === rec.stepOrder,
          )
        })

        // If no steps have active serials, skip this iteration
        if (stepsWithActiveSerials.length === 0) return

        // Pick a target step (clamped)
        const targetIdx = configs[0].targetStepIndex % stepsWithActiveSerials.length
        const targetStep = stepsWithActiveSerials[targetIdx]

        // Call the unfixed lookupStep
        const result = lookupStep(ctx, targetStep.stepId)

        // Step has active serials → result must be non-null
        expect(result, `Expected non-null result for step ${targetStep.stepId}`).not.toBeNull()
        const { job } = result!

        // Verify partCount > 0
        expect(job.partCount).toBeGreaterThan(0)

        // Verify serialIds matches expected serials at this step
        const expectedSerialIds = allTrackedSerials
          .filter(s => s.pathId === targetStep.pathId && s.currentStepIndex === targetStep.stepOrder)
          .map(s => s.id)

        expect(job.serialIds.length).toBe(expectedSerialIds.length)
        expect(new Set(job.serialIds)).toEqual(new Set(expectedSerialIds))

        // Verify partCount equals serialIds length
        expect(job.partCount).toBe(job.serialIds.length)

        // Verify all metadata fields
        expect(job.stepId).toBe(targetStep.stepId)
        expect(job.stepOrder).toBe(targetStep.stepOrder)
        expect(job.stepName).toBe(targetStep.stepName)
        expect(job.stepLocation).toBe(targetStep.stepLocation)
        expect(job.jobId).toBe(targetStep.jobId)
        expect(job.jobName).toBe(targetStep.jobName)
        expect(job.pathId).toBe(targetStep.pathId)
        expect(job.pathName).toBe(targetStep.pathName)
        expect(job.totalSteps).toBe(targetStep.totalSteps)

        // Verify isFinalStep and next step info
        const isFinalStep = targetStep.stepOrder === targetStep.totalSteps - 1
        expect(job.isFinalStep).toBe(isFinalStep)

        if (isFinalStep) {
          expect(job.nextStepName).toBeUndefined()
          expect(job.nextStepLocation).toBeUndefined()
        }

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Property 5: Preservation — Invalid Step IDs Still 404
   *
   * For any step ID that does not correspond to any existing process step
   * in the database, lookupStep returns null (404). This behavior MUST
   * be preserved after the fix.
   *
   * **Validates: Requirements 3.1**
   */
  it('Property 5: Invalid step IDs return null (MUST PASS)', () => {
    fc.assert(
      fc.property(
        jobPathConfigArb,
        fakeStepIdArb,
        (config, fakeStepId) => {
          ctx = createTestContext()
          const { jobService, pathService, serialService } = ctx

          // Create at least one job/path so the DB isn't empty
          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: Math.max(config.serialCount, 1),
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step-${i}`,
            location: config.stepLocations[i],
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: Math.max(config.serialCount, 1),
            steps,
          })

          // Create serials so the DB has real data
          serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: config.serialCount },
            'user_test',
          )

          // Call lookupStep with a fake step ID that doesn't exist
          const result = lookupStep(ctx, fakeStepId)

          // Invalid step ID → must return null (404)
          expect(result, `Fake step ID "${fakeStepId}" should return null`).toBeNull()

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
