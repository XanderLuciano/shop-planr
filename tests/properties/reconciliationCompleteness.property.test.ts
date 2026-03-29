/**
 * Property 2: Reconciliation Completeness (Count Conservation)
 *
 * For any pair of existing step lists and input step lists:
 * - |toUpdate| + |toInsert| === inputSteps.length
 * - |toUpdate| + |toDelete| === existingSteps.length
 * - No step ID appears in both toUpdate and toDelete
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { reconcileSteps } from '~/server/services/pathService'
import type { ProcessStep } from '~/server/types/domain'
import type { StepInput } from '~/server/services/pathService'

// Arbitrary for generating existing ProcessStep arrays with unique IDs
const arbExistingSteps = (maxLen: number) =>
  fc.integer({ min: 0, max: maxLen }).chain((n) =>
    fc
      .array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 30 }),
        }),
        { minLength: n, maxLength: n }
      )
      .map((items) =>
        items.map((item, i) => ({
          id: `step_${i}_${item.id}`,
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

describe('Property 2: Reconciliation Completeness (Count Conservation)', () => {
  it('toUpdate + toInsert count equals input step count', () => {
    fc.assert(
      fc.property(arbExistingSteps(10), arbInputSteps(1, 10), (existingSteps, inputSteps) => {
        const result = reconcileSteps(existingSteps, inputSteps)

        expect(result.toUpdate.length + result.toInsert.length).toBe(inputSteps.length)
      }),
      { numRuns: 100 }
    )
  })

  it('toUpdate + toDelete count equals existing step count', () => {
    fc.assert(
      fc.property(arbExistingSteps(10), arbInputSteps(1, 10), (existingSteps, inputSteps) => {
        const result = reconcileSteps(existingSteps, inputSteps)

        expect(result.toUpdate.length + result.toDelete.length).toBe(existingSteps.length)
      }),
      { numRuns: 100 }
    )
  })

  it('no step ID appears in both toUpdate and toDelete', () => {
    fc.assert(
      fc.property(arbExistingSteps(10), arbInputSteps(1, 10), (existingSteps, inputSteps) => {
        const result = reconcileSteps(existingSteps, inputSteps)

        const updateIds = new Set(result.toUpdate.map((s) => s.id))
        const deleteIds = new Set(result.toDelete)

        for (const id of deleteIds) {
          expect(updateIds.has(id)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })
})
