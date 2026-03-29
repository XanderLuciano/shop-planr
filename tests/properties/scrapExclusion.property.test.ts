/**
 * Property 1: Scrap Exclusion from Progress
 *
 * For any Job with any mix of in-progress, completed, and scrapped serials,
 * verify progressPercent = completedCount / (goalQuantity - scrappedCount) * 100.
 * Allow >100% for overproduction per requirement 7.2.
 *
 * **Validates: Requirements 3.5, 3.8**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Pure progress calculation matching the design doc formula:
 * progressPercent = completedCount / (goalQuantity - scrappedCount) * 100
 */
function computeProgressPercent(
  goalQuantity: number,
  completedCount: number,
  scrappedCount: number
): number {
  const adjustedGoal = goalQuantity - scrappedCount
  if (adjustedGoal <= 0) return completedCount > 0 ? 100 : 0
  return (completedCount / adjustedGoal) * 100
}

describe('Property 1: Scrap Exclusion from Progress', () => {
  it('progressPercent equals completedCount / (goalQuantity - scrappedCount) * 100 for any mix of part statuses', () => {
    fc.assert(
      fc.property(
        // goalQuantity: 1..100
        fc.integer({ min: 1, max: 100 }),
        // inProgressCount: 0..50
        fc.integer({ min: 0, max: 50 }),
        // completedCount: 0..50
        fc.integer({ min: 0, max: 50 }),
        // scrappedCount: 0..50
        fc.integer({ min: 0, max: 50 }),
        (goalQuantity, inProgressCount, completedCount, scrappedCount) => {
          const result = computeProgressPercent(goalQuantity, completedCount, scrappedCount)
          const adjustedGoal = goalQuantity - scrappedCount

          if (adjustedGoal <= 0) {
            // Edge case: all goal serials scrapped
            if (completedCount > 0) {
              expect(result).toBe(100)
            } else {
              expect(result).toBe(0)
            }
          } else {
            const expected = (completedCount / adjustedGoal) * 100
            expect(result).toBeCloseTo(expected, 10)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('scrapped serials reduce the denominator, increasing progress for the same completed count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (goalQuantity, completedCount) => {
          // With zero scrapped
          const progressNoScrap = computeProgressPercent(goalQuantity, completedCount, 0)
          // With some scrapped (but not enough to make adjustedGoal <= 0)
          const scrappedCount = Math.min(Math.floor(goalQuantity / 2), goalQuantity - 1)
          if (scrappedCount <= 0) return // skip degenerate case

          const progressWithScrap = computeProgressPercent(
            goalQuantity,
            completedCount,
            scrappedCount
          )

          // Scrapping reduces denominator, so progress should be >= the no-scrap case
          expect(progressWithScrap).toBeGreaterThanOrEqual(progressNoScrap)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('allows progress > 100% for overproduction (completedCount exceeds adjustedGoal)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 20 }),
        (goalQuantity, extraCompleted) => {
          const scrappedCount = 0
          const adjustedGoal = goalQuantity - scrappedCount
          const completedCount = adjustedGoal + extraCompleted // at or above goal

          const result = computeProgressPercent(goalQuantity, completedCount, scrappedCount)

          // Should be >= 100% when completed meets or exceeds adjusted goal
          expect(result).toBeGreaterThanOrEqual(100)
          // Exact value check
          const expected = (completedCount / adjustedGoal) * 100
          expect(result).toBeCloseTo(expected, 10)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('progress is 0 when no serials are completed regardless of scrapped count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        (goalQuantity, scrappedCount) => {
          const result = computeProgressPercent(goalQuantity, 0, scrappedCount)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
