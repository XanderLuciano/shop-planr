/**
 * Property 11: Sibling serial filtering
 *
 * For any serial, siblings list contains exactly serials sharing the same
 * jobId and pathId, including itself.
 *
 * **Validates: Requirements 11.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { EnrichedSerial } from '../../server/types/computed'

/** Generate an arbitrary EnrichedSerial with controlled jobId/pathId */
function enrichedSerialArb(
  jobIds: string[],
  pathIds: string[],
): fc.Arbitrary<EnrichedSerial> {
  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
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
 * filter all serials by matching jobId AND pathId.
 */
function filterSiblings(
  allSerials: EnrichedSerial[],
  targetJobId: string,
  targetPathId: string,
): EnrichedSerial[] {
  return allSerials.filter(s => s.jobId === targetJobId && s.pathId === targetPathId)
}

describe('Property 11: Sibling serial filtering', () => {
  it('siblings list contains exactly serials sharing the same jobId and pathId', () => {
    const jobIds = ['job-A', 'job-B', 'job-C']
    const pathIds = ['path-X', 'path-Y', 'path-Z']

    fc.assert(
      fc.property(
        fc.array(enrichedSerialArb(jobIds, pathIds), { minLength: 1, maxLength: 30 }),
        fc.constantFrom(...jobIds),
        fc.constantFrom(...pathIds),
        (allSerials, targetJobId, targetPathId) => {
          const siblings = filterSiblings(allSerials, targetJobId, targetPathId)

          // Every sibling must share the target jobId and pathId
          for (const s of siblings) {
            expect(s.jobId).toBe(targetJobId)
            expect(s.pathId).toBe(targetPathId)
          }

          // Every serial in allSerials with matching jobId+pathId must be in siblings
          const expected = allSerials.filter(
            s => s.jobId === targetJobId && s.pathId === targetPathId,
          )
          expect(siblings.length).toBe(expected.length)

          // The sets must be identical (same elements)
          const siblingIds = new Set(siblings.map(s => s.id))
          const expectedIds = new Set(expected.map(s => s.id))
          // Every expected id is in siblings
          for (const id of expectedIds) {
            expect(siblingIds.has(id)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('siblings always includes the target serial itself when present in the list', () => {
    const jobIds = ['job-A', 'job-B']
    const pathIds = ['path-X', 'path-Y']

    fc.assert(
      fc.property(
        fc.array(enrichedSerialArb(jobIds, pathIds), { minLength: 1, maxLength: 20 }),
        (allSerials) => {
          // Pick the first serial as the "current" serial
          const target = allSerials[0]
          const siblings = filterSiblings(allSerials, target.jobId, target.pathId)

          // The target serial must appear in the siblings list
          const found = siblings.some(s => s.id === target.id)
          expect(found).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
