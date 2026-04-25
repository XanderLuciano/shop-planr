/**
 * Feature: step-id-part-tracking
 * Property 14: Step distribution groups by currentStepId
 *
 * For any path with parts distributed across steps, getStepDistribution shall
 * count parts per step by grouping on currentStepId, and the sum of all step
 * counts plus the completed count shall equal the total non-scrapped parts on
 * the path.
 *
 * **Validates: Requirements 9.3**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'

describe('Feature: step-id-part-tracking, Property 14: Step distribution groups by currentStepId', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('sum of step partCounts + completed count equals total non-scrapped parts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 2, max: 8 }),
        fc.infiniteStream(fc.integer({ min: 0, max: 1000 })),
        (stepCount, partCount, seeds) => {
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

            // Advance each part a random number of steps
            const seedIter = seeds[Symbol.iterator]()
            let scrappedCount = 0
            for (const p of parts) {
              const advanceCount = seedIter.next().value! % (stepCount + 1) // 0..stepCount
              let current = p
              for (let i = 0; i < advanceCount; i++) {
                if (current.currentStepId === null) break
                current = ctx.partService.advancePart(current.id, 'user1')
              }

              // Scrap some parts based on seed
              const scrapSeed = seedIter.next().value!
              if (scrapSeed % 5 === 0 && current.status === 'in_progress') {
                ctx.lifecycleService.scrapPart(current.id, {
                  reason: 'damaged',
                  userId: 'user1',
                })
                scrappedCount++
              }
            }

            // Get distribution
            const distribution = ctx.pathService.getStepDistribution(path.id)

            // Sum of partCounts across all steps
            const totalAtSteps = distribution.reduce((sum, d) => sum + d.partCount, 0)

            // Count completed parts
            const completedCount = ctx.pathService.getPathCompletedCount(path.id)

            // Total non-scrapped = totalAtSteps + completedCount
            const totalNonScrapped = partCount - scrappedCount
            expect(totalAtSteps + completedCount).toBe(totalNonScrapped)

            // Each step's partCount should match actual parts at that step
            for (const entry of distribution) {
              const partsAtStep = ctx.partService.listPartsByCurrentStepId(entry.stepId)
              expect(entry.partCount).toBe(partsAtStep.length)
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
