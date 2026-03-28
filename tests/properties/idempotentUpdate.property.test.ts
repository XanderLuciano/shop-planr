/**
 * Property 5: Idempotent Update
 *
 * For any valid set of existing steps, when the input steps have the same
 * names, locations, optional flags, and dependency types as the existing
 * steps (in the same order), the reconciliation produces:
 * - toUpdate with the same length as existing steps
 * - toInsert is empty
 * - toDelete is empty
 * - Each step in toUpdate preserves the original ID
 *
 * **Validates: Requirements 6.1, 6.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { reconcileSteps } from '~/server/services/pathService'
import type { ProcessStep } from '~/server/types/domain'
import type { StepInput } from '~/server/services/pathService'

// Generate a non-empty array of existing steps with random fields
const arbExistingStepsNonEmpty = fc.integer({ min: 1, max: 10 }).chain(n =>
  fc.array(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      location: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      optional: fc.boolean(),
      dependencyType: fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const),
    }),
    { minLength: n, maxLength: n }
  ).map(items =>
    items.map((item, i) => ({
      id: item.id,
      name: item.name,
      order: i,
      location: item.location,
      optional: item.optional,
      dependencyType: item.dependencyType,
    }))
  )
)

describe('Property 5: Idempotent Update', () => {
  it('updating with identical data produces toUpdate with all existing steps, empty toInsert and toDelete', () => {
    fc.assert(
      fc.property(
        arbExistingStepsNonEmpty,
        (existingSteps: ProcessStep[]) => {
          // Derive input steps that mirror the existing steps exactly
          const inputSteps: StepInput[] = existingSteps.map(s => ({
            name: s.name,
            location: s.location,
            optional: s.optional,
            dependencyType: s.dependencyType,
          }))

          const result = reconcileSteps(existingSteps, inputSteps)

          // toUpdate should contain every existing step
          expect(result.toUpdate).toHaveLength(existingSteps.length)

          // No new steps inserted
          expect(result.toInsert).toHaveLength(0)

          // No steps deleted
          expect(result.toDelete).toHaveLength(0)

          // Each step in toUpdate preserves the original ID
          for (let i = 0; i < existingSteps.length; i++) {
            expect(result.toUpdate[i].id).toBe(existingSteps[i].id)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
