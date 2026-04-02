/**
 * Property 7: Reorder conservation and correctness
 *
 * For any valid (fromIndex, toIndex) pair within the ordered jobs list,
 * calling reorder should move the job at fromIndex to toIndex, shift other
 * jobs to fill the gap, and preserve the same set of job IDs with the same
 * total count.
 *
 * **Validates: Requirements 5.2, 5.3**
 */
import { describe, it } from 'vitest'
import fc from 'fast-check'
import type { Job } from '~/server/types/domain'
import { useJobPriority } from '~/app/composables/useJobPriority'

/**
 * Generate a list of N jobs with unique IDs and sequential priorities.
 */
function jobArb(count: number): fc.Arbitrary<Job[]> {
  return fc.constant(null).map(() =>
    Array.from({ length: count }, (_, i) => ({
      id: `job-${i}`,
      name: `Job ${i}`,
      goalQuantity: 10,
      priority: i + 1,
      createdAt: new Date(2024, 0, 1 + i).toISOString(),
      updatedAt: new Date(2024, 0, 1 + i).toISOString(),
    }))
  )
}

describe('Property 7: Reorder conservation and correctness', () => {
  it('reorder preserves the same set of job IDs and total count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }).chain((n) =>
          fc.tuple(
            jobArb(n),
            fc.integer({ min: 0, max: n - 1 }),
            fc.integer({ min: 0, max: n - 1 })
          )
        ),
        ([jobs, fromIndex, toIndex]) => {
          const { enterEditMode, reorder, orderedJobs } = useJobPriority()

          const originalIds = jobs.map((j) => j.id)
          const originalCount = jobs.length

          enterEditMode(jobs)

          reorder(fromIndex, toIndex)

          const reorderedIds = orderedJobs.value.map((j) => j.id)

          // 1. Total count is unchanged
          expect(reorderedIds.length).toBe(originalCount)

          // 2. Same set of job IDs (just reordered)
          expect([...reorderedIds].sort()).toEqual([...originalIds].sort())

          // 3. The job originally at fromIndex is now at toIndex
          expect(reorderedIds[toIndex]).toBe(originalIds[fromIndex])
        }
      ),
      { numRuns: 200 }
    )
  })
})
