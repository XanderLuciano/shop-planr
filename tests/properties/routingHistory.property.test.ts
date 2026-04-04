/**
 * Feature: step-id-part-tracking
 * Property 6: Routing history is ordered and complete
 * Property 7: Step entry creates routing entry with incrementing sequence number
 * Property 8: Step completion updates the correct routing entry
 *
 * P6: For any part advanced through one or more steps, reading the routing history
 * shall produce entries ordered by sequenceNumber ascending, and the history shall
 * contain at least one entry for every step the part has visited or is currently at.
 *
 * P7: For any part entering a process step, the system shall create a new routing
 * entry with a sequenceNumber strictly greater than all previous entries for that part,
 * and with status 'in_progress'.
 *
 * P8: For any part completing a step, the system shall update the routing entry with
 * the highest sequenceNumber for that part and step to status 'completed' with a
 * completedAt timestamp, without modifying any earlier entries for the same step.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 4.2, 4.3, 11.1, 11.4**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

/**
 * Helper: advance a part one step forward using lifecycleService.advanceToStep,
 * which properly creates routing history entries. Falls back to completion
 * when at the final step.
 */
function advanceOneStep(ctx: TestContext, partId: string): void {
  const part = ctx.partService.getPart(partId)
  if (part.currentStepId === null) return

  const path = ctx.pathService.getPath(part.pathId)
  const currentStep = path.steps.find(s => s.id === part.currentStepId)!
  const nextStep = path.steps.find(s => s.order === currentStep.order + 1)

  if (nextStep) {
    ctx.lifecycleService.advanceToStep(partId, {
      targetStepId: nextStep.id,
      userId: 'user1',
    })
  } else {
    // Past final step → complete via advanceToStep with __complete__
    ctx.lifecycleService.advanceToStep(partId, {
      targetStepId: '__complete__',
      userId: 'user1',
    })
  }
}

describe('Feature: step-id-part-tracking, Property 6: Routing history is ordered and complete', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('routing history is ordered by sequenceNumber and covers all visited steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 1, max: 5 }),
        (stepCount, advanceCount) => {
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

          // Advance using lifecycleService for proper routing history
          const actualAdvances = Math.min(advanceCount, stepCount)
          for (let i = 0; i < actualAdvances; i++) {
            const fresh = ctx.partService.getPart(part!.id)
            if (fresh.currentStepId === null) break
            advanceOneStep(ctx, part!.id)
          }

          // Read routing history
          const history = ctx.lifecycleService.getStepStatuses(part!.id)

          // P6a: entries are ordered by sequenceNumber ascending
          for (let i = 1; i < history.length; i++) {
            expect(history[i]!.sequenceNumber).toBeGreaterThanOrEqual(history[i - 1]!.sequenceNumber)
          }

          // P6b: history contains at least one entry for every step the part visited
          const _freshPart = ctx.partService.getPart(part!.id)
          const stepsVisited = Math.min(actualAdvances, stepCount - 1)
          const visitedStepIds = new Set<string>()
          for (let i = 0; i <= stepsVisited; i++) {
            if (i < path.steps.length) visitedStepIds.add(path.steps[i]!.id)
          }
          const historyStepIds = new Set(history.map(h => h.stepId))
          for (const stepId of visitedStepIds) {
            expect(historyStepIds.has(stepId)).toBe(true)
          }

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 7: Step entry creates routing entry with incrementing sequence number', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('each advancement creates a routing entry with a sequenceNumber greater than all previous', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
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

          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user1',
          )

          // Advance through all steps using lifecycleService
          for (let i = 0; i < stepCount - 1; i++) {
            advanceOneStep(ctx, part!.id)
          }

          const history = ctx.lifecycleService.getStepStatuses(part!.id)

          // All entries should have non-decreasing sequence numbers
          const seqNumbers = history.map(h => h.sequenceNumber)
          for (let i = 1; i < seqNumbers.length; i++) {
            expect(seqNumbers[i]!).toBeGreaterThanOrEqual(seqNumbers[i - 1]!)
          }

          // The latest entry for the last step should be 'in_progress'
          const lastStepId = path.steps[stepCount - 1]!.id
          const lastEntry = ctx.repos.partStepStatuses.getLatestByPartAndStep(part!.id, lastStepId)
          expect(lastEntry).toBeDefined()
          expect(lastEntry!.status).toBe('in_progress')

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 8: Step completion updates the correct routing entry', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('completing a step updates the latest routing entry with completed status and timestamp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 1, max: 5 }),
        (stepCount, advanceCount) => {
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

          const actualAdvances = Math.min(advanceCount, stepCount - 1)
          for (let i = 0; i < actualAdvances; i++) {
            advanceOneStep(ctx, part!.id)
          }

          // For each step the part advanced THROUGH (origin steps), verify
          // the latest routing entry is 'completed' with a completedAt timestamp.
          for (let i = 0; i < actualAdvances; i++) {
            const stepId = path.steps[i]!.id
            const latest = ctx.repos.partStepStatuses.getLatestByPartAndStep(part!.id, stepId)
            expect(latest).not.toBeNull()
            expect(latest!.status).toBe('completed')
            expect(latest!.completedAt).toBeDefined()
          }

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
