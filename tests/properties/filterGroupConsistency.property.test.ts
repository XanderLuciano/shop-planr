/**
 * Property CP-TAG-7: Filter-Group Consistency
 *
 * For any tag filter + grouping combination, the set of jobs visible across
 * all groups equals the set of jobs that would pass the flat filter.
 * Jobs with multiple tags may appear in multiple groups, but the union of
 * unique job IDs across groups equals the flat filtered set.
 *
 * **Validates: Requirements 13.3, 14.5**
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

describe('Property CP-TAG-7: Filter-Group Consistency', () => {
  it('union of job IDs across all groups equals the flat filtered set', () => {
    fc.assert(
      fc.property(
        arbTags().chain(tags =>
          fc.tuple(
            fc.constant(tags),
            arbJobs(tags),
            fc.subarray(tags).map(subset => subset.map(t => t.id)),
          ),
        ),
        ([allTags, jobs, filterTagIds]) => {
          // Flat filter: AND logic — job must have ALL selected filter tags
          const flatFiltered = filterTagIds.length === 0
            ? jobs
            : jobs.filter(job =>
                filterTagIds.every(id => job.tags.some(t => t.id === id)),
              )

          // Group the flat-filtered jobs
          const groups = groupJobsByTag(flatFiltered, allTags)

          // Collect unique job IDs across all groups
          const groupedJobIds = new Set<string>()
          for (const group of groups) {
            for (const job of group.jobs) {
              groupedJobIds.add(job.id)
            }
          }

          // Collect flat filtered job IDs
          const flatJobIds = new Set(flatFiltered.map(j => j.id))

          // The union of grouped job IDs must equal the flat filtered set
          expect(groupedJobIds).toEqual(flatJobIds)
        },
      ),
      { numRuns: 100 },
    )
  })
})
