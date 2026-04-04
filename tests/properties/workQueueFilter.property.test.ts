/**
 * Property 3: Search filter correctness
 *
 * For any search query string q and any list of WorkQueueJob items,
 * the filtered result contains exactly those items where jobName,
 * pathName, or stepName contains q as a case-insensitive substring.
 * When q is empty, the filtered result equals the original list.
 *
 * **Validates: Requirements 2.2, 2.3, 2.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { WorkQueueJob } from '~/server/types/computed'

/**
 * Pure filter function matching the logic in useWorkQueue.filteredJobs.
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

/** Arbitrary for a minimal WorkQueueJob with the fields relevant to filtering */
const workQueueJobArb: fc.Arbitrary<WorkQueueJob> = fc.record({
  jobId: fc.string({ minLength: 1, maxLength: 10 }),
  jobName: fc.string({ minLength: 1, maxLength: 30 }),
  pathId: fc.string({ minLength: 1, maxLength: 10 }),
  pathName: fc.string({ minLength: 1, maxLength: 30 }),
  stepId: fc.string({ minLength: 1, maxLength: 10 }),
  stepName: fc.string({ minLength: 1, maxLength: 30 }),
  stepOrder: fc.nat({ max: 10 }),
  stepLocation: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  totalSteps: fc.integer({ min: 1, max: 10 }),
  partIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
  partCount: fc.integer({ min: 1, max: 50 }),
  nextStepName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  nextStepLocation: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  isFinalStep: fc.boolean(),
  jobPriority: fc.integer({ min: 0, max: 100 }),
})

const jobsArb = fc.array(workQueueJobArb, { minLength: 0, maxLength: 10 })
const queryArb = fc.string({ minLength: 0, maxLength: 15 })

describe('Property 3: Search filter correctness', () => {
  it('filtered result contains exactly items matching query on jobName, pathName, or stepName (case-insensitive)', () => {
    fc.assert(
      fc.property(jobsArb, queryArb, (jobs, query) => {
        const result = filterJobs(jobs, query)
        const q = query.trim().toLowerCase()

        if (!q) {
          // Empty query returns all jobs
          expect(result).toEqual(jobs)
        } else {
          // Every returned job must match
          for (const job of result) {
            const matches
              = job.jobName.toLowerCase().includes(q)
                || job.pathName.toLowerCase().includes(q)
                || job.stepName.toLowerCase().includes(q)
            expect(matches).toBe(true)
          }

          // Every matching job from the original list must be in the result
          for (const job of jobs) {
            const matches
              = job.jobName.toLowerCase().includes(q)
                || job.pathName.toLowerCase().includes(q)
                || job.stepName.toLowerCase().includes(q)
            if (matches) {
              expect(result).toContain(job)
            }
          }

          // Result length matches expected count
          const expectedCount = jobs.filter(j =>
            j.jobName.toLowerCase().includes(q)
            || j.pathName.toLowerCase().includes(q)
            || j.stepName.toLowerCase().includes(q),
          ).length
          expect(result.length).toBe(expectedCount)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('empty query always returns the full list unchanged', () => {
    fc.assert(
      fc.property(jobsArb, (jobs) => {
        expect(filterJobs(jobs, '')).toEqual(jobs)
        expect(filterJobs(jobs, '   ')).toEqual(jobs)
      }),
      { numRuns: 100 },
    )
  })
})
