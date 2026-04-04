/**
 * Property 1: Clear button visibility invariant
 *
 * For any filter field in {jobName, priority, stepName} and any FilterState,
 * the clear button is rendered iff the field value is a non-empty string.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * The visibility logic used by ViewFilters.vue:
 * `v-if="filters.fieldName"` — renders the clear button when the value is truthy.
 */
function showClear(value: string | undefined): boolean {
  return !!value
}

/** Arbitrary that produces a FilterState with optional string fields and a status. */
const arbFilterState = fc.record({
  jobName: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  priority: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  stepName: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  status: fc.constantFrom('active', 'completed', 'all') as fc.Arbitrary<'active' | 'completed' | 'all'>,
})

const clearableFields = ['jobName', 'priority', 'stepName'] as const

describe('Property 1: Clear button visibility invariant', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * For any FilterState and any clearable field, the clear button is visible
   * if and only if the field value is a non-empty string.
   */
  it('clear button is visible iff the field value is a non-empty string', () => {
    fc.assert(
      fc.property(
        arbFilterState,
        fc.constantFrom(...clearableFields),
        (filters, field) => {
          const value = filters[field]
          const visible = showClear(value)

          if (value !== undefined && value !== '') {
            // Non-empty string → button must be visible
            expect(visible).toBe(true)
          } else {
            // undefined or empty string → button must be hidden
            expect(visible).toBe(false)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
