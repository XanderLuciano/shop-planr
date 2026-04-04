/**
 * Property 3: Search Filter Correctness
 *
 * For any list of WorkQueueJob entries and any non-empty search string,
 * filtering by that string should return exactly those entries where
 * jobName, pathName, or stepName contains the search string as a
 * case-insensitive substring. When the search string is empty, all
 * entries should be returned.
 *
 * **Validates: Requirements 1.6, 1.7, 5.7**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { WorkQueueJob } from '../../server/types/computed'

/**
 * Pure filter function matching the logic in usePartsView.filteredJobs.
 * Extracted here so we can test it without Vue reactivity.
 */
function filterJobs(jobs: WorkQueueJob[], query: string): WorkQueueJob[] {
  const q = query.trim().toLowerCase()
  if (!q) return jobs
  return jobs.filter(job =>
    job.jobName.toLowerCase().includes(q)
    || job.pathName.toLowerCase().includes(q)
    || job.stepName.toLowerCase().includes(q),
  )
}

// ── Arbitraries ──

const workQueueJobArb: fc.Arbitrary<WorkQueueJob> = fc.record({
  jobId: fc.uuid(),
  jobName: fc.string({ minLength: 1, maxLength: 30 }),
  pathId: fc.uuid(),
  pathName: fc.string({ minLength: 1, maxLength: 30 }),
  stepId: fc.uuid(),
  stepName: fc.string({ minLength: 1, maxLength: 30 }),
  stepOrder: fc.nat({ max: 10 }),
  stepLocation: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  totalSteps: fc.integer({ min: 1, max: 10 }),
  partIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
  partCount: fc.integer({ min: 1, max: 50 }),
  nextStepName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  nextStepLocation: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  isFinalStep: fc.boolean(),
})

const jobsArb = fc.array(workQueueJobArb, { minLength: 0, maxLength: 10 })
const nonEmptyQueryArb = fc.string({ minLength: 1, maxLength: 15 })
const queryArb = fc.string({ minLength: 0, maxLength: 15 })

// ── Tests ──

describe('Property 3: Search Filter Correctness', () => {
  it('non-empty search returns exactly entries where jobName, pathName, or stepName contains the query case-insensitively', () => {
    fc.assert(
      fc.property(jobsArb, nonEmptyQueryArb, (jobs, query) => {
        const result = filterJobs(jobs, query)
        const q = query.trim().toLowerCase()

        if (!q) {
          // query was all whitespace — treated as empty
          expect(result).toEqual(jobs)
          return
        }

        // Every returned job must match at least one field
        for (const job of result) {
          const matches
            = job.jobName.toLowerCase().includes(q)
              || job.pathName.toLowerCase().includes(q)
              || job.stepName.toLowerCase().includes(q)
          expect(matches).toBe(true)
        }

        // Every matching job from the original list must be present in the result
        for (const job of jobs) {
          const matches
            = job.jobName.toLowerCase().includes(q)
              || job.pathName.toLowerCase().includes(q)
              || job.stepName.toLowerCase().includes(q)
          if (matches) {
            expect(result).toContain(job)
          }
        }

        // Result length equals expected count (no duplicates, no omissions)
        const expectedCount = jobs.filter(j =>
          j.jobName.toLowerCase().includes(q)
          || j.pathName.toLowerCase().includes(q)
          || j.stepName.toLowerCase().includes(q),
        ).length
        expect(result.length).toBe(expectedCount)
      }),
      { numRuns: 100 },
    )
  })

  it('empty or whitespace-only search returns all entries unchanged', () => {
    fc.assert(
      fc.property(jobsArb, (jobs) => {
        expect(filterJobs(jobs, '')).toEqual(jobs)
        expect(filterJobs(jobs, '   ')).toEqual(jobs)
        expect(filterJobs(jobs, '\t')).toEqual(jobs)
      }),
      { numRuns: 100 },
    )
  })

  it('filter preserves original ordering of matching entries', () => {
    fc.assert(
      fc.property(jobsArb, queryArb, (jobs, query) => {
        const result = filterJobs(jobs, query)

        // Result should be a subsequence of the original array (same order)
        let resultIdx = 0
        for (const job of jobs) {
          if (resultIdx < result.length && job === result[resultIdx]) {
            resultIdx++
          }
        }
        expect(resultIdx).toBe(result.length)
      }),
      { numRuns: 100 },
    )
  })
})
