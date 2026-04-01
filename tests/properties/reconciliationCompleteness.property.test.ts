/**
 * Property 2: Reconciliation Completeness (Count Conservation)
 *
 * For any pair of existing step lists and input step lists:
 * - |toUpdate| + |toInsert| === inputSteps.length
 * - |toUpdate| + |toSoftDelete| === existingSteps.length
 * - No step ID appears in both toUpdate and toSoftDelete
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
  fc.integer({ min: 0, max: maxLen }).chain(n =>
    fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
      }),
      { minLength: n, maxLength: n }
    ).map(items =>
      items.map((item, i) => ({
        id: `step_${i}_${item.id}`,
        name: item.name,
        order: i,
        optional: false,
        dependencyType: 'preferred' as const,
        completedCount: 0,
      }))
    )
  )

// Arbitrary for generating input steps — some with IDs matching existing, some new
const arbInputStepsForExisting = (existing: ProcessStep[]) => {
  // Pick a random subset of existing IDs to keep, then add some new ones
  return fc.record({
    keepCount: fc.integer({ min: 0, max: existing.length }),
    newCount: fc.integer({ min: 0, max: 5 }),
  }).chain(({ keepCount, newCount }) => {
    const totalCount = keepCount + newCount
    if (totalCount === 0) {
      return fc.constant([{ name: 'Fallback' }] as StepInput[])
    }
    const kept: StepInput[] = existing.slice(0, keepCount).map(s => ({
      id: s.id,
      name: s.name,
    }))
    const newSteps: StepInput[] = Array.from({ length: newCount }, (_, i) => ({
      name: `New Step ${i}`,
    }))
    return fc.constant([...kept, ...newSteps] as StepInput[])
  })
}

describe('Property 2: Reconciliation Completeness (Count Conservation)', () => {
  it('toUpdate + toInsert count equals input step count', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10).chain(existing =>
          arbInputStepsForExisting(existing).map(input => ({ existing, input }))
        ),
        ({ existing, input }) => {
          const result = reconcileSteps(existing, input)

          expect(result.toUpdate.length + result.toInsert.length).toBe(input.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('toUpdate + toSoftDelete count equals existing step count', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10).chain(existing =>
          arbInputStepsForExisting(existing).map(input => ({ existing, input }))
        ),
        ({ existing, input }) => {
          const result = reconcileSteps(existing, input)

          expect(result.toUpdate.length + result.toSoftDelete.length).toBe(existing.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no step ID appears in both toUpdate and toSoftDelete', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10).chain(existing =>
          arbInputStepsForExisting(existing).map(input => ({ existing, input }))
        ),
        ({ existing, input }) => {
          const result = reconcileSteps(existing, input)

          const updateIds = new Set(result.toUpdate.map(s => s.id))
          const deleteIds = new Set(result.toSoftDelete)

          for (const id of deleteIds) {
            expect(updateIds.has(id)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
