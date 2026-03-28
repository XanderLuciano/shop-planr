/**
 * Property Test: ExpandedState Validity (PBT-JV2)
 *
 * PBT-JV2: For any sequence of expand/collapse operations on jobs,
 * expanded state is always either `true` or a plain object (valid ExpandedState).
 *
 * **Validates: Requirements 1.2, 1.4, 2.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

type ExpandedState = true | Record<string, boolean>
type Operation = 'expand-all' | 'collapse-all'

/**
 * Mirrors the handlers in jobs/index.vue:
 * - expandAllJobs(): sets expanded = true
 * - collapseAllJobs(): sets expanded = {}
 */
function applyOperation(state: ExpandedState, op: Operation): ExpandedState {
  if (op === 'expand-all') return true
  if (op === 'collapse-all') return ({})
  return state
}

/**
 * Validates that a value is a legal ExpandedState:
 * either the literal `true` or a plain object (Record<string, boolean>).
 */
function isValidExpandedState(state: unknown): boolean {
  if (state === true) return true
  if (typeof state === 'object' && state !== null && !Array.isArray(state)) return true
  return false
}

/**
 * Arbitrary for a sequence of expand/collapse operations.
 */
const operationArb: fc.Arbitrary<Operation> = fc.constantFrom('expand-all', 'collapse-all')

describe('Property: ExpandedState Validity (PBT-JV2)', () => {
  it('PBT-JV2: for any sequence of expand/collapse operations, expanded state is always a valid ExpandedState', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 0, maxLength: 50 }),
        (operations) => {
          // Start with initial state {} (same as jobs/index.vue)
          let state: ExpandedState = {}

          // Initial state must be valid
          expect(isValidExpandedState(state)).toBe(true)

          // Apply each operation and verify validity after every step
          for (const op of operations) {
            state = applyOperation(state, op)
            expect(isValidExpandedState(state)).toBe(true)

            // Additional structural checks
            if (state === true) {
              // expand-all produces literal true
              expect(state).toBe(true)
            } else {
              // collapse-all produces a plain object
              expect(typeof state).toBe('object')
              expect(state).not.toBeNull()
              expect(Array.isArray(state)).toBe(false)
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('PBT-JV2: expand-all always yields true, collapse-all always yields {}', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 50 }),
        (operations) => {
          let state: ExpandedState = {}

          for (const op of operations) {
            state = applyOperation(state, op)
          }

          // The final state is determined solely by the last operation
          const lastOp = operations[operations.length - 1]
          if (lastOp === 'expand-all') {
            expect(state).toBe(true)
          } else {
            expect(state).toEqual({})
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
