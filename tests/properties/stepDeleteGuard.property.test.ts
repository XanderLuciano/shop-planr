/**
 * Feature: step-id-part-tracking
 * Property 13: Delete guard for steps with active parts
 * Property 19: Soft-deleted step blocks removal when active parts present
 *
 * P13/P19: For any path update that removes a step (existing step ID not present
 * in input), if any active (non-scrapped, non-completed) part has currentStepId
 * equal to that step's ID, the system shall reject the update with a validation error.
 *
 * **Validates: Requirements 8.4, 14.2**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import { ValidationError } from '../../server/utils/errors'

describe('Feature: step-id-part-tracking, Property 13: Delete guard for steps with active parts', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('removing a step with active parts throws a validation error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 0, max: 100 }),
        (stepCount, seed) => {
          ctx = createTestContext()

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = ctx.pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: 10,
            steps,
          })

          // Create a part
          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user1',
          )

          // Advance to a random step
          const advanceTo = seed % stepCount
          let current = part!
          for (let i = 0; i < advanceTo; i++) {
            if (current.currentStepId === null) break
            current = ctx.partService.advancePart(current.id, 'user1')
          }

          const freshPart = ctx.partService.getPart(part!.id)

          // If part is completed, skip — no step to guard
          if (freshPart.currentStepId === null) {
            ctx.cleanup()
            ctx = null as any
            return
          }

          // Try to remove the step the part is at
          const stepsWithout = path.steps
            .filter(s => s.id !== freshPart.currentStepId)
            .map(s => ({ id: s.id, name: s.name }))

          expect(() => {
            ctx.pathService.updatePath(path.id, { steps: stepsWithout })
          }).toThrow(ValidationError)

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 19: Soft-deleted step blocks removal when active parts present', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('removing a step is allowed when no active parts reference it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        (stepCount) => {
          ctx = createTestContext()

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = ctx.pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: 10,
            steps,
          })

          // Create a part at step 0 and advance it to step 1
          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user1',
          )
          ctx.partService.advancePart(part!.id, 'user1')

          // Remove the LAST step (no parts there, no reorder conflict)
          const lastStep = path.steps[stepCount - 1]!
          const stepsWithoutLast = path.steps
            .filter(s => s.id !== lastStep.id)
            .map(s => ({ id: s.id, name: s.name }))

          // This should NOT throw — no active parts at the last step
          const updated = ctx.pathService.updatePath(path.id, { steps: stepsWithoutLast })
          expect(updated.steps.length).toBe(stepCount - 1)

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
