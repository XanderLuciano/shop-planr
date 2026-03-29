/**
 * Property Test: Bulk Expand Populates All Distributions (PBT-JV3)
 *
 * PBT-JV3: For any list of paths with arbitrary fetch success/failure,
 * after bulk expand, every path ID has an entry in pathDistributions
 * (either real data or empty array).
 *
 * **Validates: Requirements 3.4, 3.6**
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
 * Arbitrary for a path entry: { id, shouldSucceed, distribution }.
 * shouldSucceed controls whether the mock fetch resolves or rejects.
 */
const pathEntryArb = fc.record({
  id: fc.uuid(),
  shouldSucceed: fc.boolean(),
  distribution: fc.array(stepDistArb, { minLength: 0, maxLength: 5 }),
})

/**
 * Extracted bulk expand algorithm matching JobExpandableRow.onExpandAllPaths.
 */
async function onExpandAllPaths(
  paths: { id: string }[],
  pathDistributions: Record<string, StepDist[]>,
  fetchFn: (pathId: string) => Promise<{ distribution?: StepDist[] }>,
): Promise<void> {
  const allPathIds = paths.map(p => p.id)
  const uncachedIds = allPathIds.filter(id => !pathDistributions[id])

  const CONCURRENCY = 3
  for (let i = 0; i < uncachedIds.length; i += CONCURRENCY) {
    const batch = uncachedIds.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (pathId) => {
        const detail = await fetchFn(pathId)
        pathDistributions[pathId] = detail.distribution ?? []
      }),
    )
    for (let j = 0; j < batch.length; j++) {
      if (results[j]!.status === 'rejected' && !pathDistributions[batch[j]!]) {
        pathDistributions[batch[j]!] = []
      }
    }
  }
}

describe('Property: Bulk Expand Populates All Distributions (PBT-JV3)', () => {
  it('PBT-JV3: after bulk expand, every path ID has an entry in pathDistributions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(pathEntryArb, { minLength: 1, maxLength: 20 })
          .map(entries => {
            // Deduplicate by ID to avoid collisions
            const seen = new Set<string>()
            return entries.filter((e) => {
              if (seen.has(e.id)) return false
              seen.add(e.id)
              return true
            })
          })
          .filter(entries => entries.length > 0),
        async (pathEntries) => {
          const paths = pathEntries.map(e => ({ id: e.id }))
          const pathDistributions: Record<string, StepDist[]> = {}

          // Build a lookup for fetch behavior
          const entryMap = new Map(pathEntries.map(e => [e.id, e]))

          const fetchFn = async (pathId: string): Promise<{ distribution?: StepDist[] }> => {
            const entry = entryMap.get(pathId)!
            if (!entry.shouldSucceed) {
              throw new Error(`Simulated fetch failure for ${pathId}`)
            }
            return { distribution: entry.distribution }
          }

          await onExpandAllPaths(paths, pathDistributions, fetchFn)

          // Property: every path ID has an entry in pathDistributions
          for (const path of paths) {
            expect(pathDistributions[path.id]).toBeDefined()
            expect(Array.isArray(pathDistributions[path.id])).toBe(true)
          }

          // Successful fetches have their data, failed fetches have empty arrays
          for (const entry of pathEntries) {
            if (entry.shouldSucceed) {
              expect(pathDistributions[entry.id]).toEqual(entry.distribution)
            } else {
              expect(pathDistributions[entry.id]).toEqual([])
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
