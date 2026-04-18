/**
 * Property tests for PathStepEditor step add/remove/move operations.
 *
 * These test the pure functions that drive PathStepEditor.vue's step mutations.
 * The functions are re-implemented here as standalone pure functions (they're
 * simple array transforms). createStepDraft is imported from useJobForm.
 *
 * Properties 1–5, 9, 10 from the design document.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createStepDraft } from '~/app/composables/useJobForm'
import type { StepDraft } from '~/app/composables/useJobForm'

// ---- Pure functions under test (duplicated from PathStepEditor.vue script) ----

function addStep(steps: StepDraft[]): StepDraft[] {
  return [...steps, createStepDraft()]
}

function removeStep(steps: StepDraft[], clientId: string): StepDraft[] {
  if (steps.length <= 1) return steps
  return steps.filter(s => s._clientId !== clientId)
}

function moveStep(steps: StepDraft[], clientId: string, direction: -1 | 1): StepDraft[] {
  const idx = steps.findIndex(s => s._clientId === clientId)
  const target = idx + direction
  if (target < 0 || target >= steps.length) return steps
  const copy = [...steps]
  ;[copy[idx], copy[target]] = [copy[target]!, copy[idx]!]
  return copy
}

function fieldChange(steps: StepDraft[], clientId: string, field: keyof StepDraft, value: unknown): StepDraft[] {
  return steps.map(s => s._clientId === clientId ? { ...s, [field]: value } : s)
}

// ---- Arbitraries ----

const DEPENDENCY_TYPES = ['physical', 'preferred', 'completion_gate'] as const

/**
 * Arbitrary for a StepDraft with a unique _clientId.
 * Uses fc-generated strings for _clientId to ensure deterministic replay.
 */
function arbStepDraft(): fc.Arbitrary<StepDraft> {
  return fc.record({
    _clientId: fc.uuid(),
    name: fc.string({ minLength: 0, maxLength: 30 }),
    location: fc.string({ minLength: 0, maxLength: 30 }),
    assignedTo: fc.string({ minLength: 0, maxLength: 20 }),
    optional: fc.boolean(),
    dependencyType: fc.constantFrom(...DEPENDENCY_TYPES),
  })
}

/**
 * Arbitrary for a non-empty StepDraft[] with unique _clientId values.
 */
function arbStepDraftArray(opts?: { minLength?: number, maxLength?: number }): fc.Arbitrary<StepDraft[]> {
  const min = opts?.minLength ?? 1
  const max = opts?.maxLength ?? 15
  return fc.array(arbStepDraft(), { minLength: min, maxLength: max })
    .filter(steps => new Set(steps.map(s => s._clientId)).size === steps.length)
}

// ---- Property 1: Step count invariant on add ----

/**
 * **Validates: Requirements 2.1, 2.2, 2.3, 14.1**
 */
describe('Property 1: Step count invariant on add', () => {
  it('addStep produces length N+1, last element has unique _clientId, existing steps preserved, new step has defaults', () => {
    fc.assert(
      fc.property(arbStepDraftArray({ minLength: 0 }), (steps) => {
        const result = addStep(steps)

        // Length N+1
        expect(result).toHaveLength(steps.length + 1)

        // All existing steps preserved in order
        for (let i = 0; i < steps.length; i++) {
          expect(result[i]).toEqual(steps[i])
        }

        // New step is last
        const newStep = result[result.length - 1]!

        // Unique _clientId not in original
        const originalIds = new Set(steps.map(s => s._clientId))
        expect(originalIds.has(newStep._clientId)).toBe(false)
        expect(newStep._clientId).toBeTruthy()

        // Default values
        expect(newStep.name).toBe('')
        expect(newStep.location).toBe('')
        expect(newStep.assignedTo).toBe('')
        expect(newStep.optional).toBe(false)
        expect(newStep.dependencyType).toBe('preferred')
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 2: Step count invariant on remove ----

/**
 * **Validates: Requirements 3.1**
 */
describe('Property 2: Step count invariant on remove', () => {
  it('for steps of length N >= 2 and valid clientId, removeStep produces length N-1 without that clientId, all others preserved', () => {
    fc.assert(
      fc.property(
        arbStepDraftArray({ minLength: 2 }).chain(steps =>
          fc.record({
            steps: fc.constant(steps),
            removeIndex: fc.integer({ min: 0, max: steps.length - 1 }),
          }),
        ),
        ({ steps, removeIndex }) => {
          const targetId = steps[removeIndex]!._clientId
          const result = removeStep(steps, targetId)

          // Length N-1
          expect(result).toHaveLength(steps.length - 1)

          // Removed step not present
          expect(result.find(s => s._clientId === targetId)).toBeUndefined()

          // All others preserved in order
          const expected = steps.filter(s => s._clientId !== targetId)
          expect(result).toEqual(expected)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 3: Remove guard for single step ----

/**
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Property 3: Remove guard for single step', () => {
  it('for steps of length 1, removeStep returns array unchanged', () => {
    fc.assert(
      fc.property(arbStepDraft(), (step) => {
        const steps = [step]
        const result = removeStep(steps, step._clientId)

        // Same reference (guard returns original)
        expect(result).toBe(steps)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(step)
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 4: Move swaps exactly two adjacent steps ----

/**
 * **Validates: Requirements 4.1, 4.2, 4.5**
 */
describe('Property 4: Move swaps exactly two adjacent steps', () => {
  it('for any valid move, result has swapped steps at i and i+d, all others unchanged, same length and same set of _clientId values', () => {
    fc.assert(
      fc.property(
        arbStepDraftArray({ minLength: 2 }).chain(steps =>
          fc.record({
            steps: fc.constant(steps),
            moveIndex: fc.integer({ min: 0, max: steps.length - 1 }),
            direction: fc.constantFrom(-1 as const, 1 as const),
          }),
        ),
        ({ steps, moveIndex, direction }) => {
          const targetIdx = moveIndex + direction
          // Only test valid moves (target in bounds)
          if (targetIdx < 0 || targetIdx >= steps.length) return

          const clientId = steps[moveIndex]!._clientId
          const result = moveStep(steps, clientId, direction)

          // Same length
          expect(result).toHaveLength(steps.length)

          // Swapped positions
          expect(result[targetIdx]).toEqual(steps[moveIndex])
          expect(result[moveIndex]).toEqual(steps[targetIdx])

          // All other positions unchanged
          for (let i = 0; i < steps.length; i++) {
            if (i !== moveIndex && i !== targetIdx) {
              expect(result[i]).toEqual(steps[i])
            }
          }

          // Same set of _clientId values
          const originalIds = steps.map(s => s._clientId).sort()
          const resultIds = result.map(s => s._clientId).sort()
          expect(resultIds).toEqual(originalIds)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 5: Move is self-inverse ----

/**
 * **Validates: Requirements 4.1, 4.2**
 */
describe('Property 5: Move is self-inverse', () => {
  it('moveStep(+1) then moveStep(-1) returns original order', () => {
    fc.assert(
      fc.property(
        arbStepDraftArray({ minLength: 2 }).chain(steps =>
          fc.record({
            steps: fc.constant(steps),
            // Pick an index that can move down (not last)
            moveIndex: fc.integer({ min: 0, max: steps.length - 2 }),
          }),
        ),
        ({ steps, moveIndex }) => {
          const clientId = steps[moveIndex]!._clientId

          // Move down then back up
          const afterDown = moveStep(steps, clientId, 1)
          const afterBackUp = moveStep(afterDown, clientId, -1)

          // Should be back to original order
          expect(afterBackUp).toEqual(steps)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 9: Field changes emit complete updated array ----

/**
 * **Validates: Requirements 5.1**
 */
describe('Property 9: Field changes emit complete updated array', () => {
  it('for any field change at index i, result has same length, only changed field differs at index i', () => {
    fc.assert(
      fc.property(
        arbStepDraftArray({ minLength: 1 }).chain(steps =>
          fc.record({
            steps: fc.constant(steps),
            changeIndex: fc.integer({ min: 0, max: steps.length - 1 }),
            newName: fc.string({ minLength: 1, maxLength: 30 }),
          }),
        ),
        ({ steps, changeIndex, newName }) => {
          const clientId = steps[changeIndex]!._clientId
          const result = fieldChange(steps, clientId, 'name', newName)

          // Same length
          expect(result).toHaveLength(steps.length)

          // Changed step has new name, all other fields same
          const changed = result[changeIndex]!
          expect(changed.name).toBe(newName)
          expect(changed._clientId).toBe(steps[changeIndex]!._clientId)
          expect(changed.location).toBe(steps[changeIndex]!.location)
          expect(changed.assignedTo).toBe(steps[changeIndex]!.assignedTo)
          expect(changed.optional).toBe(steps[changeIndex]!.optional)
          expect(changed.dependencyType).toBe(steps[changeIndex]!.dependencyType)

          // All other steps identical
          for (let i = 0; i < steps.length; i++) {
            if (i !== changeIndex) {
              expect(result[i]).toEqual(steps[i])
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 10: _clientId uniqueness across all operations ----

/**
 * **Validates: Requirements 14.1, 14.2**
 */
describe('Property 10: _clientId uniqueness across all operations', () => {
  it('for any sequence of add/remove/move, every step has unique non-empty _clientId', () => {
    // Operation type: 'add', 'remove', 'move'
    const arbOp = fc.oneof(
      fc.constant('add' as const),
      fc.constant('remove' as const),
      fc.record({
        type: fc.constant('move' as const),
        direction: fc.constantFrom(-1 as const, 1 as const),
      }),
    )

    fc.assert(
      fc.property(
        fc.array(arbOp, { minLength: 1, maxLength: 20 }),
        (ops) => {
          // Start with a single step
          let steps: StepDraft[] = [createStepDraft()]

          for (const op of ops) {
            if (op === 'add') {
              steps = addStep(steps)
            } else if (op === 'remove') {
              if (steps.length >= 2) {
                // Remove the first step
                steps = removeStep(steps, steps[0]!._clientId)
              }
            } else {
              // move
              if (steps.length >= 2) {
                const idx = op.direction === 1 ? 0 : steps.length - 1
                // Only move if target is in bounds
                const target = idx + op.direction
                if (target >= 0 && target < steps.length) {
                  steps = moveStep(steps, steps[idx]!._clientId, op.direction)
                }
              }
            }

            // After every operation, check uniqueness
            const ids = steps.map(s => s._clientId)
            expect(new Set(ids).size).toBe(ids.length)
            for (const id of ids) {
              expect(id).toBeTruthy()
              expect(typeof id).toBe('string')
              expect(id.length).toBeGreaterThan(0)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
