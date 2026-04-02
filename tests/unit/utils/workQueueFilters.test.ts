import { describe, it, expect } from 'vitest'
import { applyFilters, extractAvailableValues } from '~/app/utils/workQueueFilters'
import type { WorkQueueGroup, WorkQueueJob, WorkQueueFilterState } from '~/server/types/computed'

/** Helper to build a WorkQueueJob with sensible defaults. */
function makeJob(overrides: Partial<WorkQueueJob> = {}): WorkQueueJob {
  return {
    jobId: 'job-1',
    jobName: 'Test Job',
    pathId: 'path-1',
    pathName: 'Test Path',
    stepId: 'step-1',
    stepName: 'Deburr',
    stepOrder: 1,
    totalSteps: 3,
    partIds: ['p1'],
    partCount: 1,
    isFinalStep: false,
    ...overrides,
  }
}

/** Helper to build a WorkQueueGroup with sensible defaults. */
function makeGroup(overrides: Partial<WorkQueueGroup> = {}): WorkQueueGroup {
  const jobs = overrides.jobs ?? [makeJob()]
  return {
    groupKey: 'group-1',
    groupLabel: 'Test Group',
    groupType: 'location',
    jobs,
    totalParts: jobs.reduce((sum, j) => sum + j.partCount, 0),
    ...overrides,
  }
}

const emptyFilters: WorkQueueFilterState = {}

describe('applyFilters', () => {
  // ---- Identity ----

  it('returns input unchanged when all filters and search are empty', () => {
    const groups = [
      makeGroup({ groupKey: 'A', groupLabel: 'Area A' }),
      makeGroup({ groupKey: 'B', groupLabel: 'Area B' }),
    ]

    const result = applyFilters(groups, emptyFilters, '')

    expect(result).toBe(groups) // same reference — fast path
  })

  it('returns input unchanged when filters are undefined and search is whitespace', () => {
    const groups = [makeGroup()]
    const result = applyFilters(groups, {}, '   ')
    expect(result).toBe(groups)
  })

  // ---- Location filter ----

  it('keeps only jobs matching the location filter', () => {
    const groups = [
      makeGroup({
        groupKey: 'loc',
        jobs: [
          makeJob({ jobId: 'j1', stepLocation: 'CNC Bay 1' }),
          makeJob({ jobId: 'j2', stepLocation: 'Assembly' }),
          makeJob({ jobId: 'j3', stepLocation: 'CNC Bay 1' }),
        ],
      }),
    ]

    const result = applyFilters(groups, { location: 'CNC Bay 1' }, '')

    expect(result).toHaveLength(1)
    expect(result[0].jobs).toHaveLength(2)
    expect(result[0].jobs.map(j => j.jobId)).toEqual(['j1', 'j3'])
  })

  // ---- StepName filter ----

  it('keeps only jobs matching the stepName filter', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ jobId: 'j1', stepName: 'Deburr' }),
          makeJob({ jobId: 'j2', stepName: 'QC Check' }),
        ],
      }),
    ]

    const result = applyFilters(groups, { stepName: 'Deburr' }, '')

    expect(result).toHaveLength(1)
    expect(result[0].jobs).toHaveLength(1)
    expect(result[0].jobs[0].jobId).toBe('j1')
  })

  // ---- AND logic: location + stepName ----

  it('applies AND logic across multiple property filters', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ jobId: 'j1', stepLocation: 'CNC Bay 1', stepName: 'Deburr' }),
          makeJob({ jobId: 'j2', stepLocation: 'CNC Bay 1', stepName: 'QC Check' }),
          makeJob({ jobId: 'j3', stepLocation: 'Assembly', stepName: 'Deburr' }),
        ],
      }),
    ]

    const result = applyFilters(groups, { location: 'CNC Bay 1', stepName: 'Deburr' }, '')

    expect(result).toHaveLength(1)
    expect(result[0].jobs).toHaveLength(1)
    expect(result[0].jobs[0].jobId).toBe('j1')
  })

  // ---- Text search ----

  it('text search matches jobName (case-insensitive)', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ jobId: 'j1', jobName: 'Launch Lock Body' }),
          makeJob({ jobId: 'j2', jobName: 'Bracket Assembly' }),
        ],
      }),
    ]

    const result = applyFilters(groups, emptyFilters, 'launch')

    expect(result).toHaveLength(1)
    expect(result[0].jobs).toHaveLength(1)
    expect(result[0].jobs[0].jobId).toBe('j1')
  })

  it('text search matches stepName', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ jobId: 'j1', stepName: 'Deburr' }),
          makeJob({ jobId: 'j2', stepName: 'QC Check' }),
        ],
      }),
    ]

    const result = applyFilters(groups, emptyFilters, 'qc')

    expect(result[0].jobs).toHaveLength(1)
    expect(result[0].jobs[0].jobId).toBe('j2')
  })

  it('text search matches stepLocation', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ jobId: 'j1', stepLocation: 'CNC Bay 1' }),
          makeJob({ jobId: 'j2', stepLocation: 'Assembly' }),
        ],
      }),
    ]

    const result = applyFilters(groups, emptyFilters, 'cnc')

    expect(result[0].jobs).toHaveLength(1)
    expect(result[0].jobs[0].jobId).toBe('j1')
  })

  it('text search matches groupLabel', () => {
    const groups = [
      makeGroup({
        groupLabel: 'CNC Bay 1',
        jobs: [
          makeJob({ jobId: 'j1', jobName: 'Unrelated Name', stepName: 'Deburr', stepLocation: 'Assembly' }),
        ],
      }),
      makeGroup({
        groupKey: 'other',
        groupLabel: 'Welding',
        jobs: [
          makeJob({ jobId: 'j2', jobName: 'Other Job', stepName: 'Weld', stepLocation: 'Shop' }),
        ],
      }),
    ]

    const result = applyFilters(groups, emptyFilters, 'cnc')

    // j1 matches because its groupLabel contains "CNC"
    expect(result).toHaveLength(1)
    expect(result[0].groupLabel).toBe('CNC Bay 1')
  })

  // ---- Empty group exclusion ----

  it('excludes groups where all jobs are filtered out', () => {
    const groups = [
      makeGroup({
        groupKey: 'A',
        groupLabel: 'Area A',
        jobs: [makeJob({ jobId: 'j1', stepLocation: 'CNC Bay 1' })],
      }),
      makeGroup({
        groupKey: 'B',
        groupLabel: 'Area B',
        jobs: [makeJob({ jobId: 'j2', stepLocation: 'Assembly' })],
      }),
    ]

    const result = applyFilters(groups, { location: 'CNC Bay 1' }, '')

    expect(result).toHaveLength(1)
    expect(result[0].groupKey).toBe('A')
  })

  // ---- totalParts recomputation ----

  it('recomputes totalParts for filtered groups', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ jobId: 'j1', stepLocation: 'CNC Bay 1', partCount: 5 }),
          makeJob({ jobId: 'j2', stepLocation: 'Assembly', partCount: 3 }),
        ],
        totalParts: 8,
      }),
    ]

    const result = applyFilters(groups, { location: 'CNC Bay 1' }, '')

    expect(result[0].totalParts).toBe(5)
  })

  // ---- userId filter (group-level for user groupType) ----

  it('userId filter works when groupType is user (filters at group level)', () => {
    const groups = [
      makeGroup({
        groupKey: 'user-1',
        groupLabel: 'Alice',
        groupType: 'user',
        jobs: [makeJob({ jobId: 'j1' }), makeJob({ jobId: 'j2' })],
      }),
      makeGroup({
        groupKey: 'user-2',
        groupLabel: 'Bob',
        groupType: 'user',
        jobs: [makeJob({ jobId: 'j3' })],
      }),
    ]

    const result = applyFilters(groups, { userId: 'user-1' }, '')

    expect(result).toHaveLength(1)
    expect(result[0].groupLabel).toBe('Alice')
    expect(result[0].jobs).toHaveLength(2)
  })

  it('userId filter excludes all jobs in non-matching user groups', () => {
    const groups = [
      makeGroup({
        groupKey: 'user-2',
        groupLabel: 'Bob',
        groupType: 'user',
        jobs: [makeJob({ jobId: 'j1' })],
      }),
    ]

    const result = applyFilters(groups, { userId: 'user-1' }, '')

    expect(result).toHaveLength(0)
  })
})

describe('extractAvailableValues', () => {
  it('returns unique sorted locations and stepNames', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ stepLocation: 'CNC Bay 1', stepName: 'Deburr' }),
          makeJob({ stepLocation: 'Assembly', stepName: 'QC Check' }),
          makeJob({ stepLocation: 'CNC Bay 1', stepName: 'Deburr' }), // duplicate
        ],
      }),
      makeGroup({
        groupKey: 'g2',
        jobs: [
          makeJob({ stepLocation: 'Welding', stepName: 'Assembly' }),
        ],
      }),
    ]

    const result = extractAvailableValues(groups)

    expect(result.locations).toEqual(['Assembly', 'CNC Bay 1', 'Welding'])
    expect(result.stepNames).toEqual(['Assembly', 'Deburr', 'QC Check'])
    expect(result.userIds).toEqual([])
  })

  it('excludes undefined/empty stepLocation values', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ stepLocation: undefined, stepName: 'Deburr' }),
          makeJob({ stepLocation: 'CNC Bay 1', stepName: 'QC Check' }),
        ],
      }),
    ]

    const result = extractAvailableValues(groups)

    expect(result.locations).toEqual(['CNC Bay 1'])
  })

  it('excludes empty string stepLocation values', () => {
    const groups = [
      makeGroup({
        jobs: [
          makeJob({ stepLocation: '', stepName: 'Deburr' }),
          makeJob({ stepLocation: 'Assembly', stepName: 'QC Check' }),
        ],
      }),
    ]

    const result = extractAvailableValues(groups)

    expect(result.locations).toEqual(['Assembly'])
  })

  it('returns empty arrays for empty input', () => {
    const result = extractAvailableValues([])

    expect(result.locations).toEqual([])
    expect(result.stepNames).toEqual([])
    expect(result.userIds).toEqual([])
  })

  it('returns empty arrays when groups have no jobs', () => {
    const groups = [makeGroup({ jobs: [] })]

    const result = extractAvailableValues(groups)

    expect(result.locations).toEqual([])
    expect(result.stepNames).toEqual([])
  })
})
