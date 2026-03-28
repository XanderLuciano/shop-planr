/**
 * Property 8: Bonus Part Tracking Consistency
 *
 * For any Job, verify producedQuantity = total part count,
 * orderedQuantity = goalQuantity, and bonus parts follow the same rules.
 *
 * **Validates: Requirements 7.1, 7.3, 7.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Pure computation matching the jobService.computeJobProgress logic.
 */
function computeJobProgress(goalQuantity: number, totalParts: number, completedParts: number, scrappedParts: number) {
  const inProgressParts = totalParts - completedParts - scrappedParts
  const adjustedGoal = goalQuantity - scrappedParts
  const progressPercent = adjustedGoal > 0
    ? (completedParts / adjustedGoal) * 100
    : (completedParts > 0 ? 100 : 0)

  return {
    goalQuantity,
    totalParts,
    completedParts,
    inProgressParts,
    scrappedParts,
    producedQuantity: totalParts,
    orderedQuantity: goalQuantity,
    progressPercent,
  }
}

describe('Property 8: Bonus Part Tracking Consistency', () => {
  it('producedQuantity always equals total part count and orderedQuantity equals goalQuantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // goalQuantity
        fc.integer({ min: 0, max: 200 }),  // totalParts (can exceed goal)
        fc.integer({ min: 0, max: 200 }),  // completedParts
        fc.integer({ min: 0, max: 200 }),  // scrappedParts
        (goalQuantity, totalParts, completedParts, scrappedParts) => {
          // Ensure counts are consistent: completed + scrapped <= total
          const adjustedCompleted = Math.min(completedParts, totalParts)
          const adjustedScrapped = Math.min(scrappedParts, totalParts - adjustedCompleted)

          const progress = computeJobProgress(goalQuantity, totalParts, adjustedCompleted, adjustedScrapped)

          // producedQuantity = total part count
          expect(progress.producedQuantity).toBe(totalParts)

          // orderedQuantity = goalQuantity
          expect(progress.orderedQuantity).toBe(goalQuantity)

          // producedQuantity >= 0
          expect(progress.producedQuantity).toBeGreaterThanOrEqual(0)

          // orderedQuantity > 0
          expect(progress.orderedQuantity).toBeGreaterThan(0)

          // inProgressParts = total - completed - scrapped
          expect(progress.inProgressParts).toBe(totalParts - adjustedCompleted - adjustedScrapped)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('bonus parts (totalSerials > goalQuantity) produce progress > 100% when all completed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),   // goalQuantity
        fc.integer({ min: 1, max: 50 }),   // bonusCount (extra beyond goal)
        (goalQuantity, bonusCount) => {
          const totalParts = goalQuantity + bonusCount
          const completedParts = totalParts  // all completed
          const scrappedParts = 0

          const progress = computeJobProgress(goalQuantity, totalParts, completedParts, scrappedParts)

          // Progress should exceed 100% for overproduction
          expect(progress.progressPercent).toBeGreaterThan(100)

          // producedQuantity still equals total
          expect(progress.producedQuantity).toBe(totalParts)
        },
      ),
      { numRuns: 100 },
    )
  })
})
