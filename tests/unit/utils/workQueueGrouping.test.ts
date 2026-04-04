import { describe, it, expect } from 'vitest'
import { groupEntriesByDimension } from '~/server/utils/workQueueGrouping'
import type { WorkQueueJob } from '~/server/types/computed'

/** Helper to build a WorkQueueJob with sensible defaults. Override any field via `overrides`. */
function makeJob(overrides: Partial<WorkQueueJob> & { jobPriority?: number } = {}): WorkQueueJob & { jobPriority: number } {
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
    jobPriority: 0,
    ...overrides,
  } as WorkQueueJob & { jobPriority: number }
}

describe('groupEntriesByDimension', () => {
  // ---- Empty input ----

  it('returns an empty array when entries is empty', () => {
    const result = groupEntriesByDimension([], 'user', new Map())
    expect(result).toEqual([])
  })

  // ---- Group by user ----

  describe('dimension = user', () => {
    it('groups entries by assignedTo and labels with display name', () => {
      const entries = [
        { job: makeJob({ jobId: 'j1' }), assignedTo: 'u1' },
        { job: makeJob({ jobId: 'j2' }), assignedTo: 'u1' },
        { job: makeJob({ jobId: 'j3' }), assignedTo: 'u2' },
      ]
      const nameMap = new Map([['u1', 'Alice'], ['u2', 'Bob']])

      const groups = groupEntriesByDimension(entries, 'user', nameMap)

      expect(groups).toHaveLength(2)

      const alice = groups.find(g => g.groupKey === 'u1')!
      expect(alice.groupLabel).toBe('Alice')
      expect(alice.groupType).toBe('user')
      expect(alice.jobs).toHaveLength(2)

      const bob = groups.find(g => g.groupKey === 'u2')!
      expect(bob.groupLabel).toBe('Bob')
      expect(bob.jobs).toHaveLength(1)
    })

    it('labels null assignedTo as "Unassigned"', () => {
      const entries = [
        { job: makeJob({ jobId: 'j1' }) }, // no assignedTo
      ]

      const groups = groupEntriesByDimension(entries, 'user', new Map())

      expect(groups).toHaveLength(1)
      expect(groups[0].groupKey).toBeNull()
      expect(groups[0].groupLabel).toBe('Unassigned')
    })

    it('falls back to userId when display name is missing from map', () => {
      const entries = [
        { job: makeJob(), assignedTo: 'unknown-user' },
      ]

      const groups = groupEntriesByDimension(entries, 'user', new Map())

      expect(groups[0].groupLabel).toBe('unknown-user')
    })
  })

  // ---- Group by location ----

  describe('dimension = location', () => {
    it('groups entries by stepLocation', () => {
      const entries = [
        { job: makeJob({ jobId: 'j1', stepLocation: 'CNC Bay 1' }) },
        { job: makeJob({ jobId: 'j2', stepLocation: 'CNC Bay 1' }) },
        { job: makeJob({ jobId: 'j3', stepLocation: 'Assembly' }) },
      ]

      const groups = groupEntriesByDimension(entries, 'location', new Map())

      expect(groups).toHaveLength(2)
      const cnc = groups.find(g => g.groupKey === 'CNC Bay 1')!
      expect(cnc.groupLabel).toBe('CNC Bay 1')
      expect(cnc.groupType).toBe('location')
      expect(cnc.jobs).toHaveLength(2)
    })

    it('labels null/undefined stepLocation as "No Location"', () => {
      const entries = [
        { job: makeJob({ stepLocation: undefined }) },
      ]

      const groups = groupEntriesByDimension(entries, 'location', new Map())

      expect(groups[0].groupKey).toBeNull()
      expect(groups[0].groupLabel).toBe('No Location')
    })
  })

  // ---- Group by step ----

  describe('dimension = step', () => {
    it('groups entries by stepName', () => {
      const entries = [
        { job: makeJob({ jobId: 'j1', stepName: 'Deburr' }) },
        { job: makeJob({ jobId: 'j2', stepName: 'Deburr' }) },
        { job: makeJob({ jobId: 'j3', stepName: 'QC Check' }) },
      ]

      const groups = groupEntriesByDimension(entries, 'step', new Map())

      expect(groups).toHaveLength(2)
      const deburr = groups.find(g => g.groupKey === 'Deburr')!
      expect(deburr.groupLabel).toBe('Deburr')
      expect(deburr.groupType).toBe('step')
      expect(deburr.jobs).toHaveLength(2)
    })

    it('labels null stepName as "Unknown Step"', () => {
      const entries = [
        { job: makeJob({ stepName: null as unknown as string }) },
      ]

      const groups = groupEntriesByDimension(entries, 'step', new Map())

      expect(groups[0].groupKey).toBeNull()
      expect(groups[0].groupLabel).toBe('Unknown Step')
    })
  })

  // ---- totalParts computation ----

  it('computes totalParts as sum of partCount within each group', () => {
    const entries = [
      { job: makeJob({ jobId: 'j1', stepLocation: 'A', partCount: 3 }) },
      { job: makeJob({ jobId: 'j2', stepLocation: 'A', partCount: 5 }) },
      { job: makeJob({ jobId: 'j3', stepLocation: 'B', partCount: 2 }) },
    ]

    const groups = groupEntriesByDimension(entries, 'location', new Map())

    const groupA = groups.find(g => g.groupKey === 'A')!
    expect(groupA.totalParts).toBe(8)

    const groupB = groups.find(g => g.groupKey === 'B')!
    expect(groupB.totalParts).toBe(2)
  })

  // ---- Priority sorting ----

  it('sorts jobs within each group by jobPriority descending', () => {
    const entries = [
      { job: makeJob({ jobId: 'low', stepLocation: 'X', jobPriority: 1 }) },
      { job: makeJob({ jobId: 'high', stepLocation: 'X', jobPriority: 10 }) },
      { job: makeJob({ jobId: 'mid', stepLocation: 'X', jobPriority: 5 }) },
    ]

    const groups = groupEntriesByDimension(entries, 'location', new Map())

    expect(groups).toHaveLength(1)
    const jobIds = groups[0].jobs.map(j => j.jobId)
    expect(jobIds).toEqual(['high', 'mid', 'low'])
  })

  it('treats missing jobPriority as 0', () => {
    const entries = [
      { job: makeJob({ jobId: 'with-priority', stepLocation: 'X', jobPriority: 5 }) },
      { job: makeJob({ jobId: 'no-priority', stepLocation: 'X' }) }, // jobPriority defaults to 0 in helper
    ]

    const groups = groupEntriesByDimension(entries, 'location', new Map())

    expect(groups[0].jobs[0].jobId).toBe('with-priority')
    expect(groups[0].jobs[1].jobId).toBe('no-priority')
  })

  // ---- Mixed null and non-null keys ----

  it('separates null and non-null keys into distinct groups', () => {
    const entries = [
      { job: makeJob({ jobId: 'j1' }), assignedTo: 'u1' },
      { job: makeJob({ jobId: 'j2' }) }, // null assignedTo
    ]
    const nameMap = new Map([['u1', 'Alice']])

    const groups = groupEntriesByDimension(entries, 'user', nameMap)

    expect(groups).toHaveLength(2)
    expect(groups.find(g => g.groupKey === null)!.groupLabel).toBe('Unassigned')
    expect(groups.find(g => g.groupKey === 'u1')!.groupLabel).toBe('Alice')
  })
})
