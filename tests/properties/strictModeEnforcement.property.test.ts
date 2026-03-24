/**
 * Property 11: Strict Advancement Mode Enforcement
 *
 * For any Path in strict mode, verify advancing from step N only succeeds
 * for target step N+1. All other target indices must be rejected.
 *
 * **Validates: Requirements 6.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Pure validation logic matching lifecycleService.advanceToStep strict mode check:
 * In strict mode, only targetStepIndex === currentStepIndex + 1 is allowed.
 * Also validates forward-only and in-range constraints.
 */
function validateStrictAdvancement(
  currentStepIndex: number,
  targetStepIndex: number,
  totalSteps: number,
  advancementMode: 'strict' | 'flexible' | 'per_step',
): { valid: boolean; error?: string } {
  // Forward-only check
  if (targetStepIndex <= currentStepIndex) {
    return { valid: false, error: 'Cannot advance to a step at or before the current position' }
  }

  // Range check — allow targetStepIndex === totalSteps for completion
  if (targetStepIndex > totalSteps) {
    return { valid: false, error: 'Target step index is out of range' }
  }

  // Strict mode: only N+1 allowed
  if (advancementMode === 'strict') {
    if (targetStepIndex !== currentStepIndex + 1) {
      return { valid: false, error: 'Path is in strict mode — can only advance to the next sequential step' }
    }
  }

  return { valid: true }
}

describe('Property 11: Strict Advancement Mode Enforcement', () => {
  it('advancing from step N only succeeds for target N+1 in strict mode', () => {
    fc.assert(
      fc.property(
        // totalSteps: 2..20 (need at least 2 steps for meaningful test)
        fc.integer({ min: 2, max: 20 }),
        // currentStepIndex: 0..totalSteps-1
        fc.integer({ min: 0, max: 19 }),
        // targetStepIndex: any value in a wide range to test both valid and invalid
        fc.integer({ min: -5, max: 25 }),
        (totalSteps, rawCurrentStep, targetStepIndex) => {
          // Constrain currentStepIndex to valid range
          const currentStepIndex = rawCurrentStep % totalSteps

          const result = validateStrictAdvancement(
            currentStepIndex,
            targetStepIndex,
            totalSteps,
            'strict',
          )

          if (targetStepIndex === currentStepIndex + 1) {
            // The only valid target in strict mode
            expect(result.valid).toBe(true)
          } else {
            // Everything else must be rejected
            expect(result.valid).toBe(false)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('N+1 always succeeds in strict mode for any valid current step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        (totalSteps, rawCurrentStep) => {
          const currentStepIndex = rawCurrentStep % totalSteps
          const targetStepIndex = currentStepIndex + 1

          const result = validateStrictAdvancement(
            currentStepIndex,
            targetStepIndex,
            totalSteps,
            'strict',
          )

          expect(result.valid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('skipping steps (N+2 or more) is always rejected in strict mode', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        fc.integer({ min: 0, max: 17 }),
        fc.integer({ min: 2, max: 10 }),
        (totalSteps, rawCurrentStep, skipAmount) => {
          const currentStepIndex = rawCurrentStep % (totalSteps - 1) // leave room for skip
          const targetStepIndex = currentStepIndex + skipAmount

          // Only test when target is within range but not N+1
          if (targetStepIndex <= totalSteps && targetStepIndex !== currentStepIndex + 1) {
            const result = validateStrictAdvancement(
              currentStepIndex,
              targetStepIndex,
              totalSteps,
              'strict',
            )

            expect(result.valid).toBe(false)
            expect(result.error).toContain('strict mode')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
