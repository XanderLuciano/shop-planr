/**
 * Feature: step-id-part-tracking
 * Property 3: Step reorder preserves currentStepId
 *
 * For any path with parts at various steps, when the path's steps are reordered
 * (their order values change), every part's currentStepId shall remain unchanged —
 * the part stays associated with the same physical step regardless of its new
 * position in the sequence.
 *
 * **Validates: Requirements 1.4**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'

describe('Feature: step-id-part-tracking, Property 3: Step reorder preserves currentStepId', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('reordering steps via updatePath does not change any part currentStepId', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 1, max: 5 }),
        fc.infiniteStream(fc.integer({ min: 0, max: 1000 })),
        (stepCount, partCount, seeds) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 20 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: 'Path',
              goalQuantity: 20,
              steps,
            })

            // Create parts
            const parts = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user1',
            )

            // Advance each part to a different step using seeds
            const seedIter = seeds[Symbol.iterator]()
            for (const p of parts) {
              const advanceCount = seedIter.next().value! % stepCount
              let current = p
              for (let i = 0; i < advanceCount; i++) {
                if (current.currentStepId === null) break
                current = ctx.partService.advancePart(current.id, 'user1')
              }
            }

            // Record each part's currentStepId before reorder
            const beforeReorder = parts.map((p) => {
              const fresh = ctx.partService.getPart(p.id)
              return { id: fresh.id, currentStepId: fresh.currentStepId }
            })

            // Reorder: reverse the steps (keeping same IDs, just different order)
            const reorderedSteps = [...path.steps].reverse().map((s, _i) => ({
              id: s.id,
              name: s.name,
              location: s.location,
              optional: s.optional,
              dependencyType: s.dependencyType,
            }))

            ctx.pathService.updatePath(path.id, { steps: reorderedSteps })

            // Verify each part's currentStepId is unchanged
            for (const before of beforeReorder) {
              const after = ctx.partService.getPart(before.id)
              expect(after.currentStepId).toBe(before.currentStepId)
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
