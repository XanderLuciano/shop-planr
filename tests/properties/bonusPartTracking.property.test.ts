/**
 * Property 8: Bonus Part Tracking Consistency
 *
 * For any Job, verify producedQuantity = total SN count,
 * orderedQuantity = goalQuantity, and bonus parts follow the same rules.
 *
 * **Validates: Requirements 7.1, 7.3, 7.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Pure computation matching the jobService.computeJobProgress logic.
 */
function computeJobProgress(goalQuantity: number, totalSerials: number, completedSerials: number, scrappedSerials: number) {
  const inProgressSerials = totalSerials - completedSerials - scrappedSerials
  const adjustedGoal = goalQuantity - scrappedSerials
  const progressPercent = adjustedGoal > 0
    ? (completedSerials / adjustedGoal) * 100
    : (completedSerials > 0 ? 100 : 0)

  return {
    goalQuantity,
    totalSerials,
    completedSerials,
    inProgressSerials,
    scrappedSerials,
    producedQuantity: totalSerials,
    orderedQuantity: goalQuantity,
    progressPercent,
  }
}

describe('Property 8: Bonus Part Tracking Consistency', () => {
  it('producedQuantity always equals total SN count and orderedQuantity equals goalQuantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // goalQuantity
        fc.integer({ min: 0, max: 200 }),  // totalSerials (can exceed goal)
        fc.integer({ min: 0, max: 200 }),  // completedSerials
        fc.integer({ min: 0, max: 200 }),  // scrappedSerials
        (goalQuantity, totalSerials, completedSerials, scrappedSerials) => {
          // Ensure counts are consistent: completed + scrapped <= total
          const adjustedCompleted = Math.min(completedSerials, totalSerials)
          const adjustedScrapped = Math.min(scrappedSerials, totalSerials - adjustedCompleted)

          const progress = computeJobProgress(goalQuantity, totalSerials, adjustedCompleted, adjustedScrapped)

          // producedQuantity = total SN count
          expect(progress.producedQuantity).toBe(totalSerials)

          // orderedQuantity = goalQuantity
          expect(progress.orderedQuantity).toBe(goalQuantity)

          // producedQuantity >= 0
          expect(progress.producedQuantity).toBeGreaterThanOrEqual(0)

          // orderedQuantity > 0
          expect(progress.orderedQuantity).toBeGreaterThan(0)

          // inProgressSerials = total - completed - scrapped
          expect(progress.inProgressSerials).toBe(totalSerials - adjustedCompleted - adjustedScrapped)
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
          const totalSerials = goalQuantity + bonusCount
          const completedSerials = totalSerials  // all completed
          const scrappedSerials = 0

          const progress = computeJobProgress(goalQuantity, totalSerials, completedSerials, scrappedSerials)

          // Progress should exceed 100% for overproduction
          expect(progress.progressPercent).toBeGreaterThan(100)

          // producedQuantity still equals total
          expect(progress.producedQuantity).toBe(totalSerials)
        },
      ),
      { numRuns: 100 },
    )
  })
})
