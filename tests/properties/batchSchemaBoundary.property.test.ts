/**
 * Property 3: Schema boundary enforcement
 *
 * batchAdvanceSchema SHALL accept arrays of 1–100 non-empty strings and
 * reject arrays that are empty, contain empty strings, or exceed 100 elements.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { batchAdvanceSchema } from '../../server/schemas/partSchemas'

describe('Property 3: Schema boundary enforcement', () => {
  it('accepts arrays of 1–100 non-empty strings', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }),
          { minLength: 1, maxLength: 100 },
        ),
        (partIds) => {
          const result = batchAdvanceSchema.safeParse({ partIds })
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects empty arrays', () => {
    const result = batchAdvanceSchema.safeParse({ partIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects arrays exceeding 100 elements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 200 }),
        (size) => {
          const partIds = Array.from({ length: size }, (_, i) => `part_${i}`)
          const result = batchAdvanceSchema.safeParse({ partIds })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects arrays containing empty strings', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }),
          { minLength: 0, maxLength: 10 },
        ),
        fc.integer({ min: 0, max: 10 }),
        (validIds, insertPos) => {
          // Insert an empty string at a random position
          const partIds = [...validIds]
          const pos = Math.min(insertPos, partIds.length)
          partIds.splice(pos, 0, '')
          const result = batchAdvanceSchema.safeParse({ partIds })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
