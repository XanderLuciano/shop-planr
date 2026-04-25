/**
 * Preservation Property Tests — Step 1 Disabled After Advance
 *
 * These tests verify baseline behavior that MUST be preserved after the fix.
 * They run against the UNFIXED lookupStep logic and MUST PASS on current code.
 *
 * Property 4: Steps with active parts return correct WorkQueueJob data
 * Property 5: Invalid (non-existent) step IDs return null (404)
 *
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import type { WorkQueueJob, StepViewResponse } from '../../server/types/computed'

// ---------------------------------------------------------------------------
// Replicated UNFIXED logic from server/api/operator/step/[stepId].get.ts
// ---------------------------------------------------------------------------
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
        if (parts.length === 0) return null // BUG: returns null for zero parts

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
          partIds: parts.map(s => s.id),
          partCount: parts.length,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep,
          assignedTo: step.assignedTo,
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

/** Arbitrary for a single job with one path, random steps, and random parts with advancements */
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

  beforeAll(() => { ctx = createReusableTestContext() })
  afterAll(() => { ctx?.cleanup() })

  /**
   * Property 4: Preservation — Steps With Active Parts Unchanged
   *
   * For any valid step that has active parts (parts.length > 0),
   * the unfixed lookupStep returns a non-null result with correct metadata.
   * This behavior MUST be preserved after the fix.
   *
   * **Validates: Requirements 3.2, 3.4**
   */
  it('Property 4: Active part steps return correct WorkQueueJob (MUST PASS)', () => {
    fc.assert(
      fc.property(scenarioArb, (configs) => {
        savepoint(ctx.db)
        try {
          const { jobService, pathService, partService } = ctx

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
                    tracked.currentStepOrder = -1
                  } else {
                    tracked.currentStepOrder += 1
                  }
                } catch {
                  break
                }
              }
            }
          }

          // Find steps that have active parts (parts.length > 0)
          const stepsWithActiveParts = allStepRecords.filter((rec) => {
            return allTrackedParts.some(
              s => s.pathId === rec.pathId && s.currentStepOrder === rec.stepOrder,
            )
          })

          // If no steps have active parts, skip this iteration
          if (stepsWithActiveParts.length === 0) return

          // Pick a target step (clamped)
          const targetIdx = configs[0].targetStepIndex % stepsWithActiveParts.length
          const targetStep = stepsWithActiveParts[targetIdx]

          // Call the unfixed lookupStep
          const result = lookupStep(ctx, targetStep.stepId)

          // Step has active parts → result must be non-null
          expect(result, `Expected non-null result for step ${targetStep.stepId}`).not.toBeNull()
          const { job } = result!

          // Verify partCount > 0
          expect(job.partCount).toBeGreaterThan(0)

          // Verify partIds matches expected parts at this step
          const expectedPartIds = allTrackedParts
            .filter(s => s.pathId === targetStep.pathId && s.currentStepOrder === targetStep.stepOrder)
            .map(s => s.id)

          expect(job.partIds.length).toBe(expectedPartIds.length)
          expect(new Set(job.partIds)).toEqual(new Set(expectedPartIds))

          // Verify partCount equals partIds length
          expect(job.partCount).toBe(job.partIds.length)

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
        } finally {
          rollback(ctx.db)
        }
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
          savepoint(ctx.db)
          try {
            const { jobService, pathService, partService } = ctx

            // Create at least one job/path so the DB isn't empty
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

            // Create parts so the DB has real data
            partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: config.partCount },
              'user_test',
            )

            // Call lookupStep with a fake step ID that doesn't exist
            const result = lookupStep(ctx, fakeStepId)

            // Invalid step ID → must return null (404)
            expect(result, `Fake step ID "${fakeStepId}" should return null`).toBeNull()
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
