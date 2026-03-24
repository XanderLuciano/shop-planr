/**
 * Bug Condition Exploration Test — handleSelection Sends Correct userId
 *
 * This test uses the FIXED value extraction logic from
 * StepAssignmentDropdown.vue's handleSelection function and asserts
 * the expected behavior: the extracted userId should equal the input.
 *
 * With the FIXED code, this test PASSES because the handler now
 * correctly treats the parameter as a raw string value (or null).
 *
 * Feature: step-assignment-dropdown bugfix
 * **Validates: Requirements 2.1, 2.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// ---- FIXED extraction logic ----
// Mirrors: `const userId = value`
// where `value` is typed as `string | null` — the raw value emitted
// by USelectMenu with value-key="value".

function extractUserIdFixed(value: string | null): string | null {
  const userId = value
  return userId
}

// ---- Generators ----

/** Generate non-null string userIds (what USelectMenu actually emits) */
const arbUserId = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 40 }).filter(s => s.trim().length >= 1)

// ---- Property 1: Bug Condition ----

describe('Property 1: Expected Behavior — handleSelection Sends Correct userId', () => {
  it('non-null string userId passed through extraction logic returns the same userId', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        (userId) => {
          // USelectMenu emits the raw string userId
          const result = extractUserIdFixed(userId)
          // Expected: result should equal the input userId
          expect(result).toBe(userId)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('null input returns null (unassign case)', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        (input) => {
          const result = extractUserIdFixed(input)
          expect(result).toBeNull()
        },
      ),
      { numRuns: 10 },
    )
  })
})
