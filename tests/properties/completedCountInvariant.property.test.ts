/**
 * Feature: step-id-part-tracking
 * Property 22: Completed count increments atomically on advancement
 * Property 23: Completed count survives reordering
 * Property 24: Reconciliation restores correct completed count
 *
 * P22: For any part that completes a step, the step's completedCount shall be
 * incremented by exactly 1. After N distinct parts complete a step, the step's
 * completedCount shall equal N.
 *
 * P23: For any step with completedCount = N, reordering the path's steps shall
 * not change the step's completedCount.
 *
 * P24: For any step whose completedCount has drifted, running reconciliation
 * shall set completedCount to the exact number of distinct parts with a
 * 'completed' routing entry for that step.
 *
 * **Validates: Requirements 15.1, 15.2, 15.4, 15.5, 15.7**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'

describe('Feature: step-id-part-tracking, Property 22: Completed count increments atomically on advancement', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('after N parts advance past a step, that step completedCount equals N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 8 }),
        (stepCount, partCount) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 50 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: 'Path',
              goalQuantity: 50,
              steps,
            })

            const parts = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user1',
            )

            // Advance all parts past step 0 (to step 1)
            for (const p of parts) {
              ctx.partService.advancePart(p.id, 'user1')
            }

            // Check step 0's completedCount
            const step0 = ctx.repos.paths.getStepById(path.steps[0]!.id)
            expect(step0).not.toBeNull()
            expect(step0!.completedCount).toBe(partCount)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 23: Completed count survives reordering', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('reordering steps does not change any step completedCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.integer({ min: 1, max: 4 }),
        (stepCount, partCount) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 50 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: 'Path',
              goalQuantity: 50,
              steps,
            })

            const parts = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user1',
            )

            // Advance all parts through all steps to completion
            for (const p of parts) {
              let current = p
              for (let i = 0; i < stepCount; i++) {
                if (current.currentStepId === null) break
                current = ctx.partService.advancePart(current.id, 'user1')
              }
            }

            // Record completedCounts before reorder
            const countsBefore = new Map<string, number>()
            for (const step of path.steps) {
              const s = ctx.repos.paths.getStepById(step.id)
              countsBefore.set(step.id, s!.completedCount)
            }

            // Reorder: reverse the steps
            const reorderedSteps = [...path.steps].reverse().map(s => ({
              id: s.id,
              name: s.name,
            }))
            ctx.pathService.updatePath(path.id, { steps: reorderedSteps })

            // Verify completedCounts are unchanged
            for (const [stepId, countBefore] of countsBefore) {
              const s = ctx.repos.paths.getStepById(stepId)
              expect(s!.completedCount).toBe(countBefore)
            }
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 24: Reconciliation restores correct completed count', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('after manually drifting completedCount, recounting from routing history restores correct value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: -10, max: 10 }),
        (stepCount, partCount, drift) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 50 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: 'Path',
              goalQuantity: 50,
              steps,
            })

            const parts = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user1',
            )

            // Advance all parts past step 0 using lifecycleService for proper routing entries
            const step1Id = path.steps[1]!.id
            for (const p of parts) {
              ctx.lifecycleService.advanceToStep(p.id, {
                targetStepId: step1Id,
                userId: 'user1',
              })
            }

            const step0Id = path.steps[0]!.id

            // Verify correct count first
            const correctCount = partCount

            // Manually drift the completedCount
            ctx.repos.paths.updateStep(step0Id, { completedCount: correctCount + drift })

            // Verify it's drifted
            const drifted = ctx.repos.paths.getStepById(step0Id)
            expect(drifted!.completedCount).toBe(correctCount + drift)

            // Reconcile: recount from routing history
            const actualCount = ctx.db.prepare(`
              SELECT COUNT(DISTINCT part_id) as cnt
              FROM part_step_statuses
              WHERE step_id = ? AND status = 'completed'
            `).get(step0Id) as { cnt: number }

            // Update with reconciled value
            ctx.repos.paths.updateStep(step0Id, { completedCount: actualCount.cnt })

            // Verify restored
            const restored = ctx.repos.paths.getStepById(step0Id)
            expect(restored!.completedCount).toBe(correctCount)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
