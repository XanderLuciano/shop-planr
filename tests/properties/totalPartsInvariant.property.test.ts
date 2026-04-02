/**
 * Property 2: TotalParts Invariant
 *
 * For any response from the all-work endpoint or the grouped work-queue endpoint,
 * the top-level totalParts field should equal the sum of partCount across all
 * WorkQueueJob entries in the response. For the grouped endpoint, each
 * WorkQueueGroup.totalParts should also equal the sum of partCount across that
 * group's jobs.
 *
 * **Validates: Requirements 1.4, 4.6**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type {
  WorkQueueJob,
  WorkQueueResponse,
  WorkQueueGroup,
  WorkQueueGroupedResponse,
} from '../../server/types/computed'

// ── Arbitraries ──

const workQueueJobArb: fc.Arbitrary<WorkQueueJob> = fc.record({
  jobId: fc.uuid(),
  jobName: fc.string({ minLength: 1, maxLength: 20 }),
  pathId: fc.uuid(),
  pathName: fc.string({ minLength: 1, maxLength: 20 }),
  stepId: fc.uuid(),
  stepName: fc.string({ minLength: 1, maxLength: 20 }),
  stepOrder: fc.integer({ min: 0, max: 10 }),
  stepLocation: fc.option(fc.string({ minLength: 1, maxLength: 15 }), { nil: undefined }),
  totalSteps: fc.integer({ min: 1, max: 10 }),
  partIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
  partCount: fc.integer({ min: 0, max: 100 }),
  nextStepName: fc.option(fc.string({ minLength: 1, maxLength: 15 }), { nil: undefined }),
  nextStepLocation: fc.option(fc.string({ minLength: 1, maxLength: 15 }), { nil: undefined }),
  isFinalStep: fc.boolean(),
  jobPriority: fc.integer({ min: 0, max: 100 }),
})

/** WorkQueueResponse with totalParts computed as sum of partCounts (well-formed) */
const wellFormedWorkQueueResponseArb: fc.Arbitrary<WorkQueueResponse> = fc
  .array(workQueueJobArb, { minLength: 0, maxLength: 8 })
  .map((jobs) => ({
    operatorId: '_all',
    jobs,
    totalParts: jobs.reduce((sum, j) => sum + j.partCount, 0),
  }))

/** WorkQueueGroup with totalParts computed as sum of partCounts (well-formed) */
const wellFormedGroupArb: fc.Arbitrary<WorkQueueGroup> = fc
  .tuple(
    fc.option(fc.uuid(), { nil: null }),
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.array(workQueueJobArb, { minLength: 0, maxLength: 6 }),
    fc.constantFrom('user' as const, 'location' as const, 'step' as const),
  )
  .map(([groupKey, groupLabel, jobs, groupType]) => ({
    groupKey,
    groupLabel: groupKey === null ? 'Unassigned' : groupLabel,
    groupType,
    jobs,
    totalParts: jobs.reduce((sum, j) => sum + j.partCount, 0),
  }))

/** WorkQueueGroupedResponse with totalParts computed correctly at both levels */
const wellFormedGroupedResponseArb: fc.Arbitrary<WorkQueueGroupedResponse> = fc
  .array(wellFormedGroupArb, { minLength: 0, maxLength: 5 })
  .map((groups) => ({
    groups,
    totalParts: groups.reduce((sum, g) => sum + g.totalParts, 0),
  }))

// ── Tests ──

describe('Property 2: TotalParts Invariant', () => {
  it('WorkQueueResponse.totalParts equals sum of partCount across all jobs', () => {
    fc.assert(
      fc.property(wellFormedWorkQueueResponseArb, (response) => {
        const expectedTotal = response.jobs.reduce((sum, j) => sum + j.partCount, 0)
        expect(response.totalParts).toBe(expectedTotal)
      }),
      { numRuns: 100 },
    )
  })

  it('WorkQueueGroupedResponse.totalParts equals sum of partCount across all groups and jobs', () => {
    fc.assert(
      fc.property(wellFormedGroupedResponseArb, (response) => {
        // Top-level totalParts should equal sum of all partCounts across all groups
        const expectedTotal = response.groups.reduce(
          (sum, g) => sum + g.jobs.reduce((s, j) => s + j.partCount, 0),
          0,
        )
        expect(response.totalParts).toBe(expectedTotal)
      }),
      { numRuns: 100 },
    )
  })

  it('each WorkQueueGroup.totalParts equals sum of partCount across that group\'s jobs', () => {
    fc.assert(
      fc.property(wellFormedGroupedResponseArb, (response) => {
        for (const group of response.groups) {
          const expectedGroupTotal = group.jobs.reduce((sum, j) => sum + j.partCount, 0)
          expect(group.totalParts).toBe(expectedGroupTotal)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('top-level totalParts equals sum of per-group totalParts', () => {
    fc.assert(
      fc.property(wellFormedGroupedResponseArb, (response) => {
        const sumOfGroupTotals = response.groups.reduce((sum, g) => sum + g.totalParts, 0)
        expect(response.totalParts).toBe(sumOfGroupTotals)
      }),
      { numRuns: 100 },
    )
  })
})
