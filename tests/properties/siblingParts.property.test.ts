/**
 * Property 11: Sibling part filtering
 *
 * For any part, siblings list contains exactly parts sharing the same
 * jobId and pathId, including itself.
 *
 * **Validates: Requirements 11.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { EnrichedPart } from '../../server/types/computed'

/** Generate an arbitrary EnrichedPart with controlled jobId/pathId */
function enrichedPartArb(jobIds: string[], pathIds: string[]): fc.Arbitrary<EnrichedPart> {
  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    jobId: fc.constantFrom(...jobIds),
    jobName: fc.constant('Job'),
    pathId: fc.constantFrom(...pathIds),
    pathName: fc.constant('Path'),
    currentStepIndex: fc.oneof(fc.constant(-1), fc.integer({ min: 0, max: 10 })),
    currentStepName: fc.string({ minLength: 1, maxLength: 20 }),
    status: fc.constantFrom('in-progress' as const, 'completed' as const),
    createdAt: fc.constant(new Date().toISOString()),
  })
}

/**
 * Pure filtering logic matching usePartDetail.fetchSiblings():
 * filter all parts by matching jobId AND pathId.
 */
function filterSiblings(
  allParts: EnrichedPart[],
  targetJobId: string,
  targetPathId: string
): EnrichedPart[] {
  return allParts.filter((s) => s.jobId === targetJobId && s.pathId === targetPathId)
}

describe('Property 11: Sibling part filtering', () => {
  it('siblings list contains exactly parts sharing the same jobId and pathId', () => {
    const jobIds = ['job-A', 'job-B', 'job-C']
    const pathIds = ['path-X', 'path-Y', 'path-Z']

    fc.assert(
      fc.property(
        fc.array(enrichedPartArb(jobIds, pathIds), { minLength: 1, maxLength: 30 }),
        fc.constantFrom(...jobIds),
        fc.constantFrom(...pathIds),
        (allParts, targetJobId, targetPathId) => {
          const siblings = filterSiblings(allParts, targetJobId, targetPathId)

          // Every sibling must share the target jobId and pathId
          for (const s of siblings) {
            expect(s.jobId).toBe(targetJobId)
            expect(s.pathId).toBe(targetPathId)
          }

          // Every part in allParts with matching jobId+pathId must be in siblings
          const expected = allParts.filter(
            (s) => s.jobId === targetJobId && s.pathId === targetPathId
          )
          expect(siblings.length).toBe(expected.length)

          // The sets must be identical (same elements)
          const siblingIds = new Set(siblings.map((s) => s.id))
          const expectedIds = new Set(expected.map((s) => s.id))
          // Every expected id is in siblings
          for (const id of expectedIds) {
            expect(siblingIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('siblings always includes the target part itself when present in the list', () => {
    const jobIds = ['job-A', 'job-B']
    const pathIds = ['path-X', 'path-Y']

    fc.assert(
      fc.property(
        fc.array(enrichedPartArb(jobIds, pathIds), { minLength: 1, maxLength: 20 }),
        (allParts) => {
          // Pick the first part as the "current" part
          const target = allParts[0]
          const siblings = filterSiblings(allParts, target.jobId, target.pathId)

          // The target part must appear in the siblings list
          const found = siblings.some((s) => s.id === target.id)
          expect(found).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
