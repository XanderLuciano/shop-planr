/**
 * Feature: serial-to-part-id-rename
 * Property 4: ID Generator Produces `part_`-Prefixed Sequential IDs
 *
 * For any positive integer counter value, the sequential ID generator should produce
 * an ID matching the pattern `part_NNNNN` (where N is a zero-padded digit), and
 * generating a batch of n IDs should produce exactly n unique IDs all matching this
 * pattern with strictly increasing numeric suffixes.
 *
 * **Validates: Requirements 4.6, 8.1**
 */
import { describe, it } from 'vitest'
import fc from 'fast-check'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'

const PART_ID_PATTERN = /^part_\d{5}$/

describe('Property 4: ID Generator Produces part_-Prefixed Sequential IDs', () => {
  it('next() produces a part_NNNNN ID for any positive counter value', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_998 }), (startCounter) => {
        let counter = startCounter
        const gen = createSequentialPartIdGenerator({
          getCounter: () => counter,
          setCounter: (v) => {
            counter = v
          },
        })

        const id = gen.next()

        // Must match part_NNNNN pattern
        expect(id).toMatch(PART_ID_PATTERN)

        // Numeric suffix must equal startCounter + 1
        const suffix = parseInt(id.slice('part_'.length), 10)
        expect(suffix).toBe(startCounter + 1)

        // Counter must have been incremented
        expect(counter).toBe(startCounter + 1)
      }),
      { numRuns: 100 }
    )
  })

  it('nextBatch(n) produces exactly n unique part_NNNNN IDs with strictly increasing suffixes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_000 }),
        fc.integer({ min: 1, max: 50 }),
        (startCounter, batchSize) => {
          let counter = startCounter
          const gen = createSequentialPartIdGenerator({
            getCounter: () => counter,
            setCounter: (v) => {
              counter = v
            },
          })

          const ids = gen.nextBatch(batchSize)

          // Exactly n IDs returned
          expect(ids.length).toBe(batchSize)

          // All IDs match the part_NNNNN pattern
          for (const id of ids) {
            expect(id).toMatch(PART_ID_PATTERN)
          }

          // All IDs are unique
          const uniqueIds = new Set(ids)
          expect(uniqueIds.size).toBe(batchSize)

          // Numeric suffixes are strictly increasing and sequential
          const suffixes = ids.map((id) => parseInt(id.slice('part_'.length), 10))
          for (let i = 0; i < suffixes.length; i++) {
            expect(suffixes[i]).toBe(startCounter + i + 1)
          }
          for (let i = 1; i < suffixes.length; i++) {
            expect(suffixes[i]).toBeGreaterThan(suffixes[i - 1])
          }

          // Counter must reflect the final value
          expect(counter).toBe(startCounter + batchSize)
        }
      ),
      { numRuns: 100 }
    )
  })
})
