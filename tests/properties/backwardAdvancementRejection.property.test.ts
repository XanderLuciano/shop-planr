/**
 * Property 15: Backward and Duplicate Advancement Rejection
 *
 * For any part at step N, verify advancing to M <= N is rejected.
 * Advancement is forward-only.
 *
 * **Validates: Requirements 5.7, 5.8**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Pure validation logic matching lifecycleService.advanceToStep forward-only check:
 * Rejects if targetStepOrder <= currentStepOrder.
 * Also rejects if target is out of range (> totalSteps).
 */
function validateAdvancementDirection(
  currentStepOrder: number,
  targetStepOrder: number,
  totalSteps: number,
): { valid: boolean; error?: string } {
  if (targetStepOrder <= currentStepOrder) {
    return { valid: false, error: 'Cannot advance to a step at or before the current position' }
  }
  if (targetStepOrder > totalSteps) {
    return { valid: false, error: 'Target step order is out of range' }
  }
  return { valid: true }
}

describe('Property 15: Backward and Duplicate Advancement Rejection', () => {
  it('advancing to M <= N is always rejected for any part at step N', () => {
    fc.assert(
      fc.property(
        // totalSteps: 1..20
        fc.integer({ min: 1, max: 20 }),
        // currentStepOrder: 0..totalSteps-1
        fc.integer({ min: 0, max: 19 }),
        // targetStepOrder: any value <= currentStepOrder
        fc.integer({ min: -5, max: 19 }),
        (totalSteps, rawCurrentStep, rawTarget) => {
          const currentStepOrder = rawCurrentStep % totalSteps
          // Ensure target <= current
          const targetStepOrder = Math.min(rawTarget, currentStepOrder)

          const result = validateAdvancementDirection(
            currentStepOrder,
            targetStepOrder,
            totalSteps,
          )

          expect(result.valid).toBe(false)
          expect(result.error).toContain('at or before the current position')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advancing to the same step (duplicate) is always rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        (totalSteps, rawCurrentStep) => {
          const currentStepOrder = rawCurrentStep % totalSteps

          const result = validateAdvancementDirection(
            currentStepOrder,
            currentStepOrder, // same step = duplicate
            totalSteps,
          )

          expect(result.valid).toBe(false)
          expect(result.error).toContain('at or before the current position')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advancing forward (M > N, M <= totalSteps) is always accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 0, max: 18 }),
        fc.integer({ min: 1, max: 20 }),
        (totalSteps, rawCurrentStep, forwardOffset) => {
          const currentStepOrder = rawCurrentStep % (totalSteps - 1)
          const targetStepOrder = currentStepOrder + forwardOffset

          // Only test valid forward targets within range
          if (targetStepOrder > totalSteps) return

          const result = validateAdvancementDirection(
            currentStepOrder,
            targetStepOrder,
            totalSteps,
          )

          expect(result.valid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advancing beyond totalSteps is rejected as out of range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 1, max: 10 }),
        (totalSteps, rawCurrentStep, extraOffset) => {
          const currentStepOrder = rawCurrentStep % totalSteps
          const targetStepOrder = totalSteps + extraOffset // always out of range

          const result = validateAdvancementDirection(
            currentStepOrder,
            targetStepOrder,
            totalSteps,
          )

          expect(result.valid).toBe(false)
          expect(result.error).toContain('out of range')
        },
      ),
      { numRuns: 100 },
    )
  })
})
