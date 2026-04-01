/**
 * Property 1: Step ID Preservation (ID-based reconciliation)
 *
 * For any valid path with N existing steps and M input steps where inputs
 * include step IDs, reconcileSteps matches each input to the existing step
 * with the same ID (regardless of position), preserves the step's ID in the
 * output, and assigns the new order value based on the input's position.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { reconcileSteps } from '~/server/services/pathService'
import type { ProcessStep, StepInput } from '~/server/types/domain'

// Arbitrary for generating existing ProcessStep arrays with unique IDs
const arbExistingSteps = (maxLen: number) =>
  fc.integer({ min: 1, max: maxLen }).chain(n =>
    fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
      }),
      { minLength: n, maxLength: n }
    ).filter(items => {
      // Ensure unique IDs
      const ids = items.map(i => i.id)
      return new Set(ids).size === ids.length
    }).map(items =>
      items.map((item, i) => ({
        id: item.id,
        name: item.name,
        order: i,
        optional: false,
        dependencyType: 'preferred' as const,
        completedCount: 0,
      }))
    )
  )

describe('Property 1: Step ID Preservation (ID-based reconciliation)', () => {
  it('inputs with existing IDs are matched by ID and placed in toUpdate', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(8),
        (existingSteps) => {
          // Build inputs that reference all existing step IDs but in shuffled order
          if (existingSteps.length === 0) return

          const shuffled = [...existingSteps].sort(() => Math.random() - 0.5)
          const inputSteps: StepInput[] = shuffled.map(s => ({
            id: s.id,
            name: `Updated ${s.name}`,
          }))

          const result = reconcileSteps(existingSteps, inputSteps)

          // All existing steps should be in toUpdate (matched by ID)
          expect(result.toUpdate).toHaveLength(existingSteps.length)
          expect(result.toInsert).toHaveLength(0)
          expect(result.toSoftDelete).toHaveLength(0)

          // Each toUpdate step must preserve the original ID
          for (const updated of result.toUpdate) {
            const original = existingSteps.find(s => s.id === updated.id)
            expect(original).toBeDefined()
          }

          // Order should reflect position in input array
          for (let i = 0; i < inputSteps.length; i++) {
            const updated = result.toUpdate.find(s => s.id === inputSteps[i].id!)
            expect(updated).toBeDefined()
            expect(updated!.order).toBe(i)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('inputs without IDs generate new steps in toInsert', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(5),
        fc.array(
          fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
          { minLength: 1, maxLength: 5 }
        ),
        (existingSteps, newInputs) => {
          // Build inputs: keep all existing (with IDs) + add new ones (without IDs)
          const inputSteps: StepInput[] = [
            ...existingSteps.map(s => ({ id: s.id, name: s.name })),
            ...newInputs.map(n => ({ name: n.name })),
          ]

          const result = reconcileSteps(existingSteps, inputSteps)

          expect(result.toUpdate).toHaveLength(existingSteps.length)
          expect(result.toInsert).toHaveLength(newInputs.length)
          expect(result.toSoftDelete).toHaveLength(0)

          // New steps should have generated IDs
          for (const inserted of result.toInsert) {
            expect(inserted.id).toMatch(/^step_/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('existing steps not in input are placed in toSoftDelete', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(8).filter(steps => steps.length >= 2),
        (existingSteps) => {
          // Only include the first half of existing steps in input
          const keepCount = Math.ceil(existingSteps.length / 2)
          const inputSteps: StepInput[] = existingSteps
            .slice(0, keepCount)
            .map(s => ({ id: s.id, name: s.name }))

          const result = reconcileSteps(existingSteps, inputSteps)

          expect(result.toUpdate).toHaveLength(keepCount)
          expect(result.toSoftDelete).toHaveLength(existingSteps.length - keepCount)

          // Soft-deleted IDs should be the ones not in input
          const keptIds = new Set(inputSteps.map(s => s.id))
          for (const deletedId of result.toSoftDelete) {
            expect(keptIds.has(deletedId)).toBe(false)
            expect(existingSteps.some(s => s.id === deletedId)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
