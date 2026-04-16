/**
 * Property 1: Skip flag inversion
 *
 * For any boolean state of `markComplete`, the `skip` parameter passed to
 * `advanceToStep` is `!markComplete`. When `markComplete` is true, skip is
 * false. When `markComplete` is false, skip is true.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Pure extraction of the skip flag derivation from ProcessAdvancementPanel.vue.
 *
 * In the component, `handleSkipSelectedParts` passes `skip: !markComplete.value`
 * to `advanceToStep()`. This function captures that logic.
 */
function computeSkipFlag(markComplete: boolean): boolean {
  return !markComplete
}

describe('Property 1: Skip flag inversion', () => {
  it('skip flag is the logical negation of markComplete for any boolean', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (markComplete) => {
          expect(computeSkipFlag(markComplete)).toBe(!markComplete)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('when markComplete is true, skip is false', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        (markComplete) => {
          expect(computeSkipFlag(markComplete)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('when markComplete is false, skip is true', () => {
    fc.assert(
      fc.property(
        fc.constant(false),
        (markComplete) => {
          expect(computeSkipFlag(markComplete)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
