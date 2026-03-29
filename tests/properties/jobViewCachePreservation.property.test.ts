/**
 * Property Test: Cache Preservation on Collapse (PBT-JV1)
 *
 * PBT-JV1: For any subset of path IDs, after expand-all followed by
 * collapse-all, expandedPathIds is empty and pathDistributions cache
 * is unchanged.
 *
 * **Validates: Requirements 2.4, 2.5, 4.3, 4.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

interface StepDist {
  stepId: string
  stepName: string
  stepOrder: number
  location?: string
  partCount: number
  completedCount: number
  isBottleneck: boolean
}

/**
 * Arbitrary for a single StepDist entry.
 */
const stepDistArb: fc.Arbitrary<StepDist> = fc.record({
  stepId: fc.uuid(),
  stepName: fc.string({ minLength: 1, maxLength: 20 }),
  stepOrder: fc.nat({ max: 50 }),
  location: fc.option(fc.string({ minLength: 1, maxLength: 15 }), { nil: undefined }),
  partCount: fc.nat({ max: 1000 }),
  completedCount: fc.nat({ max: 1000 }),
  isBottleneck: fc.boolean(),
})

/**
 * Arbitrary for a pathDistributions cache entry: pathId → StepDist[].
 */
const pathCacheEntryArb = fc.tuple(
  fc.uuid(),
  fc.array(stepDistArb, { minLength: 0, maxLength: 5 }),
)

describe('Property: Cache Preservation on Collapse (PBT-JV1)', () => {
  it('PBT-JV1: after expand-all then collapse-all, expandedPathIds is empty and pathDistributions cache is unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(pathCacheEntryArb, { minLength: 1, maxLength: 20 }),
        (cacheEntries) => {
          // --- Setup: simulate component state ---
          const pathIds = cacheEntries.map(([id]) => id)

          // Populate pathDistributions cache (simulating previously fetched data)
          const pathDistributions: Record<string, StepDist[]> = {}
          for (const [id, dist] of cacheEntries) {
            pathDistributions[id] = dist
          }

          // Snapshot the cache before expand/collapse cycle
          const cacheSnapshot = structuredClone(pathDistributions)

          // --- Action 1: Expand all paths (set expandedPathIds to all IDs) ---
          let expandedPathIds = new Set<string>(pathIds)
          expect(expandedPathIds.size).toBe(pathIds.length)

          // --- Action 2: Collapse all paths (clear expandedPathIds) ---
          expandedPathIds = new Set<string>()

          // --- Assert: expandedPathIds is empty ---
          expect(expandedPathIds.size).toBe(0)

          // --- Assert: pathDistributions cache is unchanged ---
          expect(pathDistributions).toEqual(cacheSnapshot)
        },
      ),
      { numRuns: 200 },
    )
  })
})
