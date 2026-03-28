/**
 * Property 1: Step ID Preservation
 *
 * For any valid path with N existing steps and M input steps (M ≥ 1),
 * the first min(N, M) output steps in toUpdate retain their original IDs.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { reconcileSteps } from '~/server/services/pathService'
import type { ProcessStep } from '~/server/types/domain'
import type { StepInput } from '~/server/services/pathService'

// Arbitrary for generating existing ProcessStep arrays
const arbExistingSteps = (maxLen: number) =>
  fc.integer({ min: 0, max: maxLen }).chain(n =>
    fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
      }),
      { minLength: n, maxLength: n }
    ).map(items =>
      items.map((item, i) => ({
        id: item.id,
        name: item.name,
        order: i,
        optional: false,
        dependencyType: 'preferred' as const,
      }))
    )
  )

// Arbitrary for generating input steps
const arbInputSteps = (minLen: number, maxLen: number) =>
  fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 30 }),
    }),
    { minLength: minLen, maxLength: maxLen }
  )

describe('Property 1: Step ID Preservation', () => {
  it('first min(N, M) output steps in toUpdate retain their original IDs', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10),
        arbInputSteps(1, 10),
        (existingSteps, inputSteps) => {
          const result = reconcileSteps(existingSteps, inputSteps)

          const overlap = Math.min(existingSteps.length, inputSteps.length)

          // toUpdate should have exactly `overlap` entries
          expect(result.toUpdate).toHaveLength(overlap)

          // Each toUpdate step must preserve the original ID from existingSteps
          for (let i = 0; i < overlap; i++) {
            expect(result.toUpdate[i].id).toBe(existingSteps[i].id)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
