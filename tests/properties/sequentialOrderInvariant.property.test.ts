/**
 * Property 4: Sequential Order Invariant
 *
 * For any path update, the resulting step_order values across all steps
 * (toUpdate and toInsert combined) form a sequential sequence from 0 to N-1
 * with no gaps or duplicates.
 *
 * **Validates: Requirements 2.4, 5.3**
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

describe('Property 4: Sequential Order Invariant', () => {
  it('all steps in toUpdate and toInsert combined have sequential order values 0..N-1', () => {
    fc.assert(
      fc.property(
        arbExistingSteps(10),
        arbInputSteps(1, 10),
        (existingSteps, inputSteps) => {
          const result = reconcileSteps(existingSteps, inputSteps)

          const allSteps = [...result.toUpdate, ...result.toInsert]
          const orders = allSteps.map(s => s.order).sort((a, b) => a - b)

          // Total output steps must equal input step count
          expect(orders).toHaveLength(inputSteps.length)

          // Orders must be exactly [0, 1, 2, ..., N-1]
          for (let i = 0; i < orders.length; i++) {
            expect(orders[i]).toBe(i)
          }

          // No duplicate order values
          const uniqueOrders = new Set(orders)
          expect(uniqueOrders.size).toBe(orders.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})
