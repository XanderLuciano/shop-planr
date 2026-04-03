import { describe, it, expect } from 'vitest'
import { groupEntriesByDimension } from '~/server/utils/workQueueGrouping'
import type { WorkQueueJob, GroupByDimension } from '~/server/types/computed'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GROUP_BY: GroupByDimension[] = ['user', 'location', 'step']

/**
 * Mimics the API route's groupBy validation logic from work-queue.get.ts:
 *   const groupBy = VALID_GROUP_BY.includes(rawGroupBy) ? rawGroupBy : 'location'
 */
function validateGroupBy(raw: unknown): GroupByDimension {
  return VALID_GROUP_BY.includes(raw as GroupByDimension)
    ? (raw as GroupByDimension)
    : 'location'
}

/** Build a WorkQueueJob with sensible defaults. */
function makeJob(overrides: Partial<WorkQueueJob> = {}): WorkQueueJob {
  return {
    jobId: 'job-1',
    jobName: 'Test Job',
    pathId: 'path-1',
    pathName: 'Test Path',
    stepId: 'step-1',
    stepName: 'Deburr',
    stepOrder: 0,
    stepLocation: 'CNC Bay 1',
    totalSteps: 3,
    partIds: ['p1'],
    partCount: 1,
    isFinalStep: false,
    jobPriority: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Realistic entries that mirror what the API route builds
// ---------------------------------------------------------------------------

const realisticEntries = [
  {
    job: makeJob({ jobId: 'j1', jobName: 'Launch Lock Body', stepName: 'Deburr', stepLocation: 'CNC Bay 1', partCount: 3, jobPriority: 5 }),
    assignedTo: 'user-alice',
  },
  {
    job: makeJob({ jobId: 'j2', jobName: 'Bracket Assembly', stepName: 'QC Check', stepLocation: 'QC Lab', partCount: 2, jobPriority: 10 }),
    assignedTo: 'user-bob',
  },
  {
    job: makeJob({ jobId: 'j3', jobName: 'Control Board Rev C', stepName: 'Deburr', stepLocation: 'CNC Bay 1', partCount: 4, jobPriority: 1 }),
    assignedTo: 'user-alice',
  },
  {
    job: makeJob({ jobId: 'j4', jobName: 'Shaft Housing', stepName: 'Assembly', stepLocation: 'Assembly Floor', partCount: 1, jobPriority: 8 }),
    assignedTo: undefined, // unassigned
  },
]

const userNameMap = new Map([
  ['user-alice', 'Alice'],
  ['user-bob', 'Bob'],
])

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Work Queue API grouping logic', () => {
  // ---- groupBy validation (mirrors API route logic) ----

  describe('groupBy validation', () => {
    it.each(['user', 'location', 'step'] as const)(
      'accepts valid dimension "%s"',
      (dim) => {
        expect(validateGroupBy(dim)).toBe(dim)
      },
    )

    it('defaults to "location" for an invalid string', () => {
      expect(validateGroupBy('invalid')).toBe('location')
    })

    it('defaults to "location" for an empty string', () => {
      expect(validateGroupBy('')).toBe('location')
    })

    it('defaults to "location" for undefined', () => {
      expect(validateGroupBy(undefined)).toBe('location')
    })

    it('defaults to "location" for null', () => {
      expect(validateGroupBy(null)).toBe('location')
    })
  })

  // ---- Grouping by user ----

  describe('groupBy = user', () => {
    it('produces groups keyed by assignedTo with correct labels', () => {
      const groups = groupEntriesByDimension(realisticEntries, 'user', userNameMap)

      const alice = groups.find(g => g.groupKey === 'user-alice')!
      expect(alice).toBeDefined()
      expect(alice.groupLabel).toBe('Alice')
      expect(alice.groupType).toBe('user')
      expect(alice.jobs.map(j => j.jobId)).toContain('j1')
      expect(alice.jobs.map(j => j.jobId)).toContain('j3')

      const bob = groups.find(g => g.groupKey === 'user-bob')!
      expect(bob).toBeDefined()
      expect(bob.groupLabel).toBe('Bob')
      expect(bob.jobs).toHaveLength(1)

      const unassigned = groups.find(g => g.groupKey === null)!
      expect(unassigned).toBeDefined()
      expect(unassigned.groupLabel).toBe('Unassigned')
      expect(unassigned.jobs).toHaveLength(1)
    })
  })

  // ---- Grouping by location ----

  describe('groupBy = location', () => {
    it('produces groups keyed by stepLocation', () => {
      const groups = groupEntriesByDimension(realisticEntries, 'location', userNameMap)

      const cncBay = groups.find(g => g.groupKey === 'CNC Bay 1')!
      expect(cncBay).toBeDefined()
      expect(cncBay.groupLabel).toBe('CNC Bay 1')
      expect(cncBay.groupType).toBe('location')
      expect(cncBay.jobs).toHaveLength(2)

      const qcLab = groups.find(g => g.groupKey === 'QC Lab')!
      expect(qcLab).toBeDefined()
      expect(qcLab.jobs).toHaveLength(1)

      const assembly = groups.find(g => g.groupKey === 'Assembly Floor')!
      expect(assembly).toBeDefined()
      expect(assembly.jobs).toHaveLength(1)
    })
  })

  // ---- Grouping by step ----

  describe('groupBy = step', () => {
    it('produces groups keyed by stepName', () => {
      const groups = groupEntriesByDimension(realisticEntries, 'step', userNameMap)

      const deburr = groups.find(g => g.groupKey === 'Deburr')!
      expect(deburr).toBeDefined()
      expect(deburr.groupLabel).toBe('Deburr')
      expect(deburr.groupType).toBe('step')
      expect(deburr.jobs).toHaveLength(2)

      const qc = groups.find(g => g.groupKey === 'QC Check')!
      expect(qc).toBeDefined()
      expect(qc.jobs).toHaveLength(1)

      const assembly = groups.find(g => g.groupKey === 'Assembly')!
      expect(assembly).toBeDefined()
      expect(assembly.jobs).toHaveLength(1)
    })
  })

  // ---- Backward compatibility: no groupBy → default to location ----

  describe('backward compatibility', () => {
    it('when no groupBy is provided (undefined), defaults to location grouping', () => {
      const dimension = validateGroupBy(undefined)
      expect(dimension).toBe('location')

      const groups = groupEntriesByDimension(realisticEntries, dimension, userNameMap)

      // Should produce location-based groups, not user-based
      expect(groups.every(g => g.groupType === 'location')).toBe(true)
      const keys = groups.map(g => g.groupKey)
      expect(keys).toContain('CNC Bay 1')
      expect(keys).toContain('QC Lab')
      expect(keys).toContain('Assembly Floor')
    })

    it('invalid groupBy falls through to location grouping end-to-end', () => {
      const dimension = validateGroupBy('bogus')
      const groups = groupEntriesByDimension(realisticEntries, dimension, userNameMap)

      expect(groups.every(g => g.groupType === 'location')).toBe(true)
    })
  })
})
