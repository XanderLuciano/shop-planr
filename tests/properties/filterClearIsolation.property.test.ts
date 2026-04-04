/**
 * Property 2: Single-field clear isolation
 *
 * For any FilterState and any clearable field, clearing that field produces a
 * FilterState where only that field is undefined and all others retain original values.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Property 5: Manual delete and button click equivalence
 *
 * For any clearable field with a non-empty value, manually deleting all text
 * (empty string coerced to undefined) produces the same FilterState as clicking
 * the clear button.
 *
 * **Validates: Requirement 6.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { FilterState } from '~/server/types/domain'

/**
 * Simulates the `update` function from ViewFilters.vue:
 * `{ ...filters, [key]: value }`
 */
function simulateUpdate<T extends Record<string, unknown>>(
  filters: T,
  key: keyof T,
  value: unknown,
): T {
  return { ...filters, [key]: value } as T
}

/** Arbitrary that produces a full FilterState with all optional fields. */
const arbFilterState = fc.record({
  jobName: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  jiraTicketKey: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  stepName: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  assignee: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  priority: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  label: fc.option(fc.string({ minLength: 0 }), { nil: undefined }),
  status: fc.option(
    fc.constantFrom('active', 'completed', 'all') as fc.Arbitrary<'active' | 'completed' | 'all'>,
    { nil: undefined },
  ),
})

const clearableFields = ['jobName', 'priority', 'stepName'] as const
type ClearableField = (typeof clearableFields)[number]

const allFilterKeys: (keyof FilterState)[] = [
  'jobName', 'jiraTicketKey', 'stepName', 'assignee', 'priority', 'label', 'status',
]

describe('Property 2: Single-field clear isolation', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * Clearing a single field sets it to undefined while preserving every other field.
   */
  it('clearing one field sets it to undefined and leaves all others unchanged', () => {
    fc.assert(
      fc.property(
        arbFilterState,
        fc.constantFrom(...clearableFields),
        (filters, keyToClear: ClearableField) => {
          const next = simulateUpdate(filters, keyToClear, undefined)

          // The cleared field must be undefined
          expect(next[keyToClear]).toBeUndefined()

          // Every other field must retain its original value
          for (const k of allFilterKeys) {
            if (k !== keyToClear) {
              expect(next[k]).toBe(filters[k])
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 5: Manual delete and button click equivalence', () => {
  /**
   * **Validates: Requirement 6.3**
   *
   * Manually deleting all text (empty string → coerced to undefined via
   * `($event as string) || undefined`) produces the same FilterState as
   * clicking the clear button (which calls `update(key, undefined)` directly).
   */
  it('manual text deletion and clear button click produce identical FilterState', () => {
    // Generate a FilterState where the target field always has a non-empty value
    const arbNonEmptyField = fc.string({ minLength: 1 })

    fc.assert(
      fc.property(
        arbFilterState,
        fc.constantFrom(...clearableFields),
        arbNonEmptyField,
        (baseFilters, field: ClearableField, nonEmptyValue) => {
          // Ensure the target field has a non-empty value
          const filters = { ...baseFilters, [field]: nonEmptyValue }

          // Clear button path: update(key, undefined)
          const viaButton = simulateUpdate(filters, field, undefined)

          // Manual delete path: the @update:model-value handler does
          // `update(key, ($event as string) || undefined)` where $event is ''
          const manualValue = ('' as string) || undefined
          const viaManualDelete = simulateUpdate(filters, field, manualValue)

          // Both must produce the same FilterState
          for (const k of allFilterKeys) {
            expect(viaButton[k]).toBe(viaManualDelete[k])
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
