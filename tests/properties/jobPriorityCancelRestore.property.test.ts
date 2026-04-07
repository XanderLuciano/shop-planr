/**
 * Property 6: Cancel restores snapshot
 *
 * For any sequence of reorder operations performed after entering edit mode,
 * calling cancelEdit should restore the job order to the exact snapshot taken
 * at enterEditMode, with identical ordering and contents.
 *
 * **Validates: Requirement 4.4**
 */
import { describe, it, vi } from 'vitest'
import fc from 'fast-check'
import type { Job } from '~/server/types/domain'

// Stub useAuthFetch — useJobPriority calls it but priority tests only exercise sync logic
vi.stubGlobal('useAuthFetch', () => vi.fn())

// eslint-disable-next-line import/first
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
    })),
  )
}

/**
 * Generate a sequence of (fromIndex, toIndex) reorder operations
 * valid for a list of the given size.
 */
function reorderOpsArb(listSize: number): fc.Arbitrary<[number, number][]> {
  if (listSize < 2) return fc.constant([])
  return fc.array(
    fc.tuple(
      fc.integer({ min: 0, max: listSize - 1 }),
      fc.integer({ min: 0, max: listSize - 1 }),
    ),
    { minLength: 0, maxLength: 20 },
  )
}

describe('Property 6: Cancel restores snapshot', () => {
  it('cancelEdit restores the exact original order after any sequence of reorders', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).chain(n =>
          fc.tuple(jobArb(n), reorderOpsArb(n)),
        ),
        ([jobs, ops]) => {
          const { enterEditMode, reorder, cancelEdit, orderedJobs, isEditingPriority } = useJobPriority()

          // Snapshot the original order
          const originalIds = jobs.map(j => j.id)

          // Enter edit mode
          enterEditMode(jobs)
          expect(isEditingPriority.value).toBe(true)

          // Apply random reorder operations
          for (const [from, to] of ops) {
            reorder(from, to)
          }

          // Cancel — should restore exact original order
          cancelEdit()

          expect(isEditingPriority.value).toBe(false)
          const restoredIds = orderedJobs.value.map(j => j.id)
          expect(restoredIds).toEqual(originalIds)
        },
      ),
      { numRuns: 200 },
    )
  })
})
