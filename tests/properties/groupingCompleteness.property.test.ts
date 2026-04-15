/**
 * Property CP-TAG-6: Grouping Completeness
 *
 * For any set of jobs with arbitrary tag assignments, the union of all
 * job IDs across all groups returned by `groupJobsByTag` equals the set
 * of input job IDs. No job is lost during grouping.
 *
 * **Validates: Requirements 14.1, 14.2, 14.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { groupJobsByTag } from '~/app/utils/jobTagGrouping'
import type { Tag, Job } from '~/app/types/domain'

/** Arbitrary that generates a list of 1–5 tags with unique IDs. */
function arbTags(): fc.Arbitrary<Tag[]> {
  return fc.integer({ min: 1, max: 5 }).chain(count =>
    fc.tuple(
      fc.uniqueArray(fc.uuid(), { minLength: count, maxLength: count }),
      fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: count, maxLength: count }),
    ).map(([ids, names]) =>
      ids.map((id, i) => ({
        id,
        name: names[i],
        color: '#8b5cf6',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    ),
  )
}

/** Arbitrary that generates 1–20 jobs, each with a random subset of the provided tags. */
function arbJobs(tags: Tag[]): fc.Arbitrary<(Job & { tags: Tag[] })[]> {
  const arbJobWithTags = fc.tuple(
    fc.uuid(),
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.subarray(tags),
  ).map(([id, name, jobTags]) => ({
    id,
    name,
    goalQuantity: 1,
    priority: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: jobTags,
  }))

  return fc.array(arbJobWithTags, { minLength: 1, maxLength: 20 })
}

describe('Property CP-TAG-6: Grouping Completeness', () => {
  it('every input job appears in at least one group — no job is lost', () => {
    fc.assert(
      fc.property(
        arbTags().chain(tags => fc.tuple(fc.constant(tags), arbJobs(tags))),
        ([allTags, jobs]) => {
          const groups = groupJobsByTag(jobs, allTags)

          // Collect all unique job IDs across all groups
          const groupedJobIds = new Set<string>()
          for (const group of groups) {
            for (const job of group.jobs) {
              groupedJobIds.add(job.id)
            }
          }

          // Collect input job IDs
          const inputJobIds = new Set(jobs.map(j => j.id))

          // The union of grouped job IDs must equal the input job IDs
          expect(groupedJobIds).toEqual(inputJobIds)
        },
      ),
      { numRuns: 100 },
    )
  })
})
