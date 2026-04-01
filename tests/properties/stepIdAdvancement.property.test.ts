/**
 * Feature: step-id-part-tracking
 * Property 2: Advancement past final step completes part
 * Property 4: Next-step resolution by order
 *
 * P2: For any part whose currentStepId references the final step in its path,
 * advancing that part shall set currentStepId to null and status to 'completed'.
 *
 * P4: For any part at a non-final step, advancing the part shall set currentStepId
 * to the ID of the process step whose order is exactly one greater than the current
 * step's order in the path.
 *
 * **Validates: Requirements 1.3, 2.1, 2.2, 10.2, 10.4**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

describe('Feature: step-id-part-tracking, Property 2: Advancement past final step completes part', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('advancing a part at the final step sets currentStepId to null and status to completed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        (stepCount) => {
          ctx = createTestContext()

          // Create job + path with N steps
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

          // Advance through all steps to reach the final step
          let current = part!
          for (let i = 0; i < stepCount - 1; i++) {
            current = ctx.partService.advancePart(current.id, 'user1')
          }

          // Verify we're at the final step
          expect(current.currentStepId).toBe(path.steps[stepCount - 1]!.id)

          // Advance past the final step
          const completed = ctx.partService.advancePart(current.id, 'user1')

          expect(completed.currentStepId).toBeNull()
          expect(completed.status).toBe('completed')

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 4: Next-step resolution by order', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('advancing a part at a non-final step sets currentStepId to the step with order + 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.integer({ min: 0, max: 100 }),
        (stepCount, advanceSeed) => {
          ctx = createTestContext()

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = ctx.pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: 10,
            steps,
          })

          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user1',
          )

          // Advance to a random non-final step
          const advanceTo = advanceSeed % (stepCount - 1) // 0..stepCount-2
          let current = part!
          for (let i = 0; i < advanceTo; i++) {
            current = ctx.partService.advancePart(current.id, 'user1')
          }

          // current is at step[advanceTo], which is non-final
          const currentStepId = current.currentStepId
          const currentStep = path.steps.find(s => s.id === currentStepId)!
          const expectedNextStep = path.steps.find(s => s.order === currentStep.order + 1)!

          // Advance one more
          const advanced = ctx.partService.advancePart(current.id, 'user1')

          expect(advanced.currentStepId).toBe(expectedNextStep.id)

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
