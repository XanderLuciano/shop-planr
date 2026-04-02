/**
 * Property Tests for Work Queue Filtering & Grouping
 *
 * Tests the pure functions `groupEntriesByDimension` and `applyFilters`
 * against formal correctness properties from the design document.
 *
 * Properties tested:
 *   CP-WQF-1:  Grouping Completeness
 *   CP-WQF-2:  Filter Subset
 *   CP-WQF-3:  Empty Filter Identity
 *   CP-WQF-4:  Filter Monotonicity
 *   CP-WQF-6:  Group-By Dimension Consistency
 *   CP-WQF-10: Priority Ordering
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { groupEntriesByDimension } from '~/server/utils/workQueueGrouping'
import { applyFilters } from '~/app/utils/workQueueFilters'
import type {
  WorkQueueJob,
  WorkQueueGroup,
  WorkQueueFilterState,
  GroupByDimension,
} from '~/server/types/computed'

// ---------------------------------------------------------------------------
// Arbitrary generators
// ---------------------------------------------------------------------------

/** Non-empty alphanumeric string for identifiers and names */
const arbId = () => fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/)

/** Optional location string (undefined ~30% of the time) */
const arbOptionalLocation = () =>
  fc.option(fc.constantFrom('CNC Bay 1', 'Assembly', 'Welding', 'QC Area', 'Shipping'), { nil: undefined, freq: 3 })

/** Step name from a realistic set */
const arbStepName = () =>
  fc.constantFrom('Deburr', 'QC Check', 'Assembly', 'Weld', 'Paint', 'Pack', 'Inspect')

/** User ID (optional for assignedTo) */
const arbOptionalUserId = () =>
  fc.option(fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4'), { nil: undefined, freq: 3 })

/**
 * Arbitrary WorkQueueJob with an extra `jobPriority` field via type assertion.
 * The `jobPriority` field is not yet on the WorkQueueJob type (added in task 4.1),
 * but the grouping function accesses it via a cast.
 */
const arbWorkQueueJob = (): fc.Arbitrary<WorkQueueJob & { jobPriority: number }> =>
  fc.record({
    jobId: arbId(),
    jobName: fc.stringMatching(/^[A-Z][a-z]{2,8}$/),
    pathId: arbId(),
    pathName: fc.stringMatching(/^[A-Z][a-z]{2,8}$/),
    stepId: arbId(),
    stepName: arbStepName(),
    stepOrder: fc.integer({ min: 1, max: 10 }),
    stepLocation: arbOptionalLocation(),
    totalSteps: fc.integer({ min: 1, max: 10 }),
    partIds: fc.array(arbId(), { minLength: 1, maxLength: 5 }),
    partCount: fc.integer({ min: 1, max: 50 }),
    isFinalStep: fc.boolean(),
    jobPriority: fc.integer({ min: 0, max: 100 }),
  }).map((r) => ({
    ...r,
    partIds: r.partIds as readonly string[],
  })) as fc.Arbitrary<WorkQueueJob & { jobPriority: number }>

/** Arbitrary work queue entry (job + optional assignedTo + location) */
const arbWorkQueueEntry = () =>
  fc.record({
    job: arbWorkQueueJob(),
    assignedTo: arbOptionalUserId(),
    location: arbOptionalLocation(),
  })

/** Arbitrary GroupByDimension */
const arbGroupByDimension = (): fc.Arbitrary<GroupByDimension> =>
  fc.constantFrom('user' as const, 'location' as const, 'step' as const)

/** Arbitrary WorkQueueGroup built from a non-empty list of jobs */
const arbWorkQueueGroup = (): fc.Arbitrary<WorkQueueGroup> =>
  fc.record({
    groupKey: fc.option(arbId(), { nil: null, freq: 2 }),
    groupLabel: fc.stringMatching(/^[A-Za-z ]{1,15}$/),
    groupType: arbGroupByDimension(),
    jobs: fc.array(arbWorkQueueJob(), { minLength: 1, maxLength: 8 }),
  }).map((r) => ({
    ...r,
    totalParts: r.jobs.reduce((sum: number, j: WorkQueueJob) => sum + j.partCount, 0),
  }))

/** Arbitrary WorkQueueFilterState with optional fields */
const arbFilterState = (): fc.Arbitrary<WorkQueueFilterState> =>
  fc.record({
    location: fc.option(fc.constantFrom('CNC Bay 1', 'Assembly', 'Welding', 'QC Area', 'Shipping'), { nil: undefined, freq: 5 }),
    stepName: fc.option(arbStepName(), { nil: undefined, freq: 5 }),
    userId: fc.option(fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4'), { nil: undefined, freq: 5 }),
  })

/** User name map for grouping tests */
const arbUserNameMap = (): fc.Arbitrary<Map<string, string>> =>
  fc.constant(new Map([
    ['user-1', 'Alice'],
    ['user-2', 'Bob'],
    ['user-3', 'Charlie'],
    ['user-4', 'Diana'],
  ]))

// ---------------------------------------------------------------------------
// CP-WQF-1: Grouping Completeness
// ---------------------------------------------------------------------------

describe('Property 1: Grouping Completeness (CP-WQF-1)', () => {
  /**
   * **Validates: Requirements 2.4, 2.5, 2.6**
   *
   * For any set of entries and any valid groupBy dimension, every entry
   * appears in exactly one group, sum of totalParts equals input total,
   * and no group has zero jobs.
   */
  it('every entry appears in exactly one group, totalParts sums match, no empty groups', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkQueueEntry(), { minLength: 0, maxLength: 20 }),
        arbGroupByDimension(),
        arbUserNameMap(),
        (entries, dimension, userNameMap) => {
          const groups = groupEntriesByDimension(entries, dimension, userNameMap)

          // 1. Every entry appears in exactly one group
          const allGroupedJobs = groups.flatMap((g) => g.jobs)
          expect(allGroupedJobs).toHaveLength(entries.length)

          // Verify each entry's job is present (by reference identity)
          for (const entry of entries) {
            const count = allGroupedJobs.filter((j) => j === entry.job).length
            expect(count).toBe(1)
          }

          // 2. Sum of totalParts equals input total
          const inputTotalParts = entries.reduce((sum, e) => sum + e.job.partCount, 0)
          const groupTotalParts = groups.reduce((sum, g) => sum + g.totalParts, 0)
          expect(groupTotalParts).toBe(inputTotalParts)

          // 3. No empty groups
          for (const group of groups) {
            expect(group.jobs.length).toBeGreaterThan(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// CP-WQF-2: Filter Subset
// ---------------------------------------------------------------------------

describe('Property 2: Filter Subset (CP-WQF-2)', () => {
  /**
   * **Validates: Requirements 4.2, 4.3, 4.4**
   *
   * For any groups and any filter combination, every job in filtered output
   * exists in input, no duplicates, and ordering is preserved.
   */
  it('filtered output is a subset of input with preserved ordering and no duplicates', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkQueueGroup(), { minLength: 1, maxLength: 5 }),
        arbFilterState(),
        fc.stringMatching(/^[a-zA-Z]{0,6}$/),
        (groups, filters, searchQuery) => {
          const result = applyFilters(groups, filters, searchQuery)

          // Collect all input jobs in order (groupIndex, jobIndex)
          const inputJobOrder: WorkQueueJob[] = groups.flatMap((g) => g.jobs)
          const resultJobs: WorkQueueJob[] = result.flatMap((g) => g.jobs)

          // 1. Every result job exists in input (subset)
          for (const job of resultJobs) {
            expect(inputJobOrder).toContain(job)
          }

          // 2. No duplicates in result
          const uniqueJobs = new Set(resultJobs)
          expect(uniqueJobs.size).toBe(resultJobs.length)

          // 3. Ordering preserved: result jobs appear in same relative order as input
          let lastInputIdx = -1
          for (const job of resultJobs) {
            const idx = inputJobOrder.indexOf(job, lastInputIdx + 1)
            expect(idx).toBeGreaterThan(lastInputIdx)
            lastInputIdx = idx
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// CP-WQF-3: Empty Filter Identity
// ---------------------------------------------------------------------------

describe('Property 3: Empty Filter Identity (CP-WQF-3)', () => {
  /**
   * **Validates: Requirement 4.5**
   *
   * When all filters are empty/undefined and search query is empty,
   * applyFilters returns the input groups unchanged.
   */
  it('returns input unchanged when all filters and search are empty', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkQueueGroup(), { minLength: 0, maxLength: 5 }),
        (groups) => {
          const emptyFilters: WorkQueueFilterState = {}
          const result = applyFilters(groups, emptyFilters, '')

          // Same reference — fast path returns input directly
          expect(result).toBe(groups)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// CP-WQF-4: Filter Monotonicity
// ---------------------------------------------------------------------------

describe('Property 4: Filter Monotonicity (CP-WQF-4)', () => {
  /**
   * **Validates: Requirements 4.2, 5.3**
   *
   * Adding an additional filter can only narrow or maintain the result set,
   * never expand it.
   */
  it('adding a filter narrows or maintains the result set', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkQueueGroup(), { minLength: 1, maxLength: 5 }),
        fc.stringMatching(/^[a-zA-Z]{0,6}$/),
        fc.constantFrom('location' as const, 'stepName' as const),
        fc.constantFrom('CNC Bay 1', 'Assembly', 'Deburr', 'QC Check'),
        (groups, searchQuery, extraKey, extraValue) => {
          // Start with NO property filters — only text search
          const baseFilters: WorkQueueFilterState = {}
          const baseResult = applyFilters(groups, baseFilters, searchQuery)
          const baseJobCount = baseResult.reduce((sum, g) => sum + g.jobs.length, 0)

          // Add exactly one property filter
          const extendedFilters: WorkQueueFilterState = { [extraKey]: extraValue }
          const extendedResult = applyFilters(groups, extendedFilters, searchQuery)
          const extendedJobCount = extendedResult.reduce((sum, g) => sum + g.jobs.length, 0)

          // Monotonicity: extended result ≤ base result
          expect(extendedJobCount).toBeLessThanOrEqual(baseJobCount)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// CP-WQF-6: Group-By Dimension Consistency
// ---------------------------------------------------------------------------

describe('Property 6: Group-By Dimension Consistency (CP-WQF-6)', () => {
  /**
   * **Validates: Requirement 1.4**
   *
   * Every group in the response has groupType matching the requested dimension.
   */
  it('every group has groupType matching the requested dimension', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkQueueEntry(), { minLength: 1, maxLength: 20 }),
        arbGroupByDimension(),
        arbUserNameMap(),
        (entries, dimension, userNameMap) => {
          const groups = groupEntriesByDimension(entries, dimension, userNameMap)

          for (const group of groups) {
            expect(group.groupType).toBe(dimension)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// CP-WQF-10: Priority Ordering
// ---------------------------------------------------------------------------

describe('Property 10: Priority Ordering (CP-WQF-10)', () => {
  /**
   * **Validates: Requirement 3.1**
   *
   * Jobs within each group are sorted by jobPriority descending.
   * For any adjacent pair jobs[i] and jobs[i+1],
   * jobs[i].jobPriority >= jobs[i+1].jobPriority.
   */
  it('jobs within each group are sorted by jobPriority descending', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkQueueEntry(), { minLength: 1, maxLength: 20 }),
        arbGroupByDimension(),
        arbUserNameMap(),
        (entries, dimension, userNameMap) => {
          const groups = groupEntriesByDimension(entries, dimension, userNameMap)

          for (const group of groups) {
            for (let i = 0; i < group.jobs.length - 1; i++) {
              const currPriority = ((group.jobs[i] as unknown as Record<string, unknown>).jobPriority as number) ?? 0
              const nextPriority = ((group.jobs[i + 1] as unknown as Record<string, unknown>).jobPriority as number) ?? 0
              expect(currPriority).toBeGreaterThanOrEqual(nextPriority)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
