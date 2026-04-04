/**
 * Property 3: Append-Only Inserts
 *
 * For any reconciliation output, all step IDs in the toInsert set are freshly
 * generated (start with `step_` prefix), disjoint from existing step IDs,
 * and unique within the insert set.
 *
 * **Validates: Requirements 1.3, 2.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { reconcileSteps } from '~/server/services/pathService'

// Arbitrary for generating existing ProcessStep arrays
const arbExistingSteps = (maxLen: number) =>
  fc.integer({ min: 0, max: maxLen }).chain(n =>
    fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
      }),
      { minLength: n, maxLength: n },
    ).map(items =>
      items.map((item, i) => ({
        id: item.id,
        name: item.name,
        order: i,
        optional: false,
        dependencyType: 'preferred' as const,
      })),
    ),
  )

// Arbitrary for generating input steps (more than existing to force inserts)
const arbInputSteps = (minLen: number, maxLen: number) =>
  fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 30 }),
    }),
    { minLength: minLen, maxLength: maxLen },
  )

describe('Property 3: Append-Only Inserts', () => {
  it('all IDs in toInsert start with step_ (freshly generated)', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10),
        arbInputSteps(1, 15),
        (existingSteps, inputSteps) => {
          const result = reconcileSteps(existingSteps, inputSteps)

          for (const step of result.toInsert) {
            expect(step.id).toMatch(/^step_/)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('no ID in toInsert appears in the existing step IDs set', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10),
        arbInputSteps(1, 15),
        (existingSteps, inputSteps) => {
          const result = reconcileSteps(existingSteps, inputSteps)

          const existingIds = new Set(existingSteps.map(s => s.id))
          for (const step of result.toInsert) {
            expect(existingIds.has(step.id)).toBe(false)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('all IDs in toInsert are unique (no duplicates within the insert set)', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10),
        arbInputSteps(1, 15),
        (existingSteps, inputSteps) => {
          const result = reconcileSteps(existingSteps, inputSteps)

          const insertIds = result.toInsert.map(s => s.id)
          const uniqueIds = new Set(insertIds)
          expect(uniqueIds.size).toBe(insertIds.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})
