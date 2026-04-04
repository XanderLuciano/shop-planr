/**
 * Feature: step-id-part-tracking
 * Property 12: Reconcile steps by ID preserves step identity
 *
 * For any set of existing steps and input steps where inputs include step IDs,
 * reconcileSteps shall match each input to the existing step with the same ID
 * (regardless of position), preserve the step's ID in the output, and assign
 * the new order value based on the input's position in the array.
 *
 * **Validates: Requirements 8.1, 8.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { reconcileSteps } from '../../server/services/pathService'
import type { ProcessStep, StepInput } from '../../server/types/domain'

function makeStep(id: string, order: number, name?: string): ProcessStep {
  return {
    id,
    name: name ?? `Step ${id}`,
    order,
    optional: false,
    dependencyType: 'preferred',
    completedCount: 0,
  }
}

describe('Feature: step-id-part-tracking, Property 12: Reconcile steps by ID preserves step identity', () => {
  it('inputs with IDs match existing steps by ID and get new order from position', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }).chain((count) => {
          // Generate existing steps
          const existingSteps = Array.from({ length: count }, (_, i) =>
            makeStep(`step_${i}`, i, `Step ${i}`),
          )

          // Generate a permutation of the step IDs (reorder)
          return fc.shuffledSubarray(
            existingSteps.map(s => s.id),
            { minLength: count, maxLength: count },
          ).map(shuffledIds => ({ existingSteps, shuffledIds }))
        }),
        ({ existingSteps, shuffledIds }) => {
          // Build inputs with IDs in shuffled order
          const inputs: StepInput[] = shuffledIds.map((id) => {
            const orig = existingSteps.find(s => s.id === id)!
            return { id, name: orig.name }
          })

          const result = reconcileSteps(existingSteps, inputs)

          // All steps should be in toUpdate (none inserted, none deleted)
          expect(result.toUpdate.length).toBe(existingSteps.length)
          expect(result.toInsert.length).toBe(0)
          expect(result.toSoftDelete.length).toBe(0)

          // Each updated step preserves its ID
          for (const updated of result.toUpdate) {
            expect(existingSteps.some(s => s.id === updated.id)).toBe(true)
          }

          // Each updated step gets order = its position in the input array
          for (let i = 0; i < inputs.length; i++) {
            const updated = result.toUpdate.find(s => s.id === inputs[i]!.id!)
            expect(updated).toBeDefined()
            expect(updated!.order).toBe(i)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('inputs without IDs are inserted as new steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 3 }),
        (existingCount, newCount) => {
          const existingSteps = Array.from({ length: existingCount }, (_, i) =>
            makeStep(`step_${i}`, i),
          )

          // Keep all existing + add new ones without IDs
          const inputs: StepInput[] = [
            ...existingSteps.map(s => ({ id: s.id, name: s.name })),
            ...Array.from({ length: newCount }, (_, i) => ({
              name: `New Step ${i}`,
            })),
          ]

          const result = reconcileSteps(existingSteps, inputs)

          expect(result.toUpdate.length).toBe(existingCount)
          expect(result.toInsert.length).toBe(newCount)
          expect(result.toSoftDelete.length).toBe(0)

          // New steps should have generated IDs (not matching any existing)
          for (const inserted of result.toInsert) {
            expect(existingSteps.every(s => s.id !== inserted.id)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('existing steps not in input are marked for soft-delete', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 1, max: 3 }),
        (existingCount, removeCount) => {
          const actualRemove = Math.min(removeCount, existingCount - 1)
          const existingSteps = Array.from({ length: existingCount }, (_, i) =>
            makeStep(`step_${i}`, i),
          )

          // Keep only a subset of existing steps
          const keptSteps = existingSteps.slice(actualRemove)
          const inputs: StepInput[] = keptSteps.map(s => ({ id: s.id, name: s.name }))

          const result = reconcileSteps(existingSteps, inputs)

          expect(result.toSoftDelete.length).toBe(actualRemove)

          // Soft-deleted IDs should be the ones we removed
          const removedIds = existingSteps.slice(0, actualRemove).map(s => s.id)
          expect(new Set(result.toSoftDelete)).toEqual(new Set(removedIds))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('preserves completedCount from existing steps during reconciliation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 5 }),
        (stepCount, counts) => {
          const actualCount = Math.min(stepCount, counts.length)
          const existingSteps = Array.from({ length: actualCount }, (_, i) =>
            makeStep(`step_${i}`, i),
          )
          // Set completedCount on existing steps
          for (let i = 0; i < actualCount; i++) {
            existingSteps[i]!.completedCount = counts[i]!
          }

          const inputs: StepInput[] = existingSteps.map(s => ({ id: s.id, name: s.name }))
          const result = reconcileSteps(existingSteps, inputs)

          for (let i = 0; i < actualCount; i++) {
            const updated = result.toUpdate.find(s => s.id === existingSteps[i]!.id)
            expect(updated).toBeDefined()
            expect(updated!.completedCount).toBe(counts[i]!)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
