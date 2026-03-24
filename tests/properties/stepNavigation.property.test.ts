/**
 * Property 6: Step navigation URL round-trip
 *
 * For any stepId: constructing URL with the step ID path param and
 * parsing back yields the original stepId; matching logic finds the correct
 * queue entry.
 *
 * **Validates: Requirements 2.1, 2.2, 7.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { WorkQueueJob } from '../../server/types/computed'

/**
 * Constructs the navigation URL used by jobs/[id].vue and parts/index.vue
 * when a step is clicked.
 * Mirrors: navigateTo(`/parts/step/${stepId}`)
 */
function buildStepNavigationUrl(stepId: string): string {
  return `/parts/step/${encodeURIComponent(stepId)}`
}

/**
 * Parses stepId from a step view URL path.
 * Mirrors what useRoute().params.stepId provides in /parts/step/[stepId].vue
 */
function parseStepId(url: string): string | undefined {
  const prefix = '/parts/step/'
  if (!url.startsWith(prefix)) return undefined
  const encoded = url.slice(prefix.length)
  return decodeURIComponent(encoded)
}

/**
 * Matching logic to find the correct WorkQueueJob entry by stepId.
 */
function findMatchingQueueEntry(
  jobs: WorkQueueJob[],
  stepId: string,
): WorkQueueJob | undefined {
  return jobs.find(j => j.stepId === stepId)
}

/** Arbitrary for non-empty ID strings (simulating nanoid-style IDs) */
const idArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/)

describe('Property 6: Step navigation URL round-trip', () => {
  it('constructing URL with stepId and parsing back yields original value', () => {
    fc.assert(
      fc.property(idArb, (stepId) => {
        const url = buildStepNavigationUrl(stepId)
        const parsed = parseStepId(url)

        expect(parsed).toBe(stepId)
      }),
      { numRuns: 100 },
    )
  })

  it('matching logic finds the correct queue entry for any valid stepId', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.array(idArb, { minLength: 0, maxLength: 5 }),
        (targetStepId, otherStepIds) => {
          const targetJob: WorkQueueJob = {
            jobId: 'job_1',
            jobName: 'Target Job',
            pathId: 'path_1',
            pathName: 'Target Path',
            stepId: targetStepId,
            stepName: 'Target Step',
            stepOrder: 0,
            totalSteps: 3,
            serialIds: ['SN-001'],
            partCount: 1,
            isFinalStep: false,
          }

          const otherJobs: WorkQueueJob[] = otherStepIds
            .filter(id => id !== targetStepId)
            .map(id => ({
              jobId: 'job_2',
              jobName: 'Other Job',
              pathId: 'path_2',
              pathName: 'Other Path',
              stepId: id,
              stepName: 'Other Step',
              stepOrder: 1,
              totalSteps: 3,
              serialIds: ['SN-002'],
              partCount: 1,
              isFinalStep: false,
            }))

          const allJobs = [...otherJobs, targetJob]

          const url = buildStepNavigationUrl(targetStepId)
          const parsed = parseStepId(url)

          const match = findMatchingQueueEntry(allJobs, parsed!)

          expect(match).toBeDefined()
          expect(match!.stepId).toBe(targetStepId)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns undefined when no queue entry matches the parsed stepId', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.array(idArb, { minLength: 0, maxLength: 5 }),
        (targetStepId, otherStepIds) => {
          const nonMatchingJobs: WorkQueueJob[] = otherStepIds
            .filter(id => id !== targetStepId)
            .map(id => ({
              jobId: 'job_1',
              jobName: 'Job',
              pathId: 'path_1',
              pathName: 'Path',
              stepId: id,
              stepName: 'Step',
              stepOrder: 0,
              totalSteps: 1,
              serialIds: ['SN-001'],
              partCount: 1,
              isFinalStep: true,
            }))

          const url = buildStepNavigationUrl(targetStepId)
          const parsed = parseStepId(url)

          const match = findMatchingQueueEntry(nonMatchingJobs, parsed!)

          expect(match).toBeUndefined()
        },
      ),
      { numRuns: 100 },
    )
  })
})
