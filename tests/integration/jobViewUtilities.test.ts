/**
 * Integration tests for the full expand/collapse flow.
 *
 * Tests the orchestration logic from jobs/index.vue and
 * JobExpandableRow as pure functions (no SFC compilation).
 *
 * Feature: job-view-utilities
 * Requirements: 1.2, 2.2, 3.2, 3.4, 4.2, 4.3, 7.1, 7.2, 7.3
 */
import { describe, it, expect, vi } from 'vitest'
import type { ExpandedState } from '@tanstack/vue-table'

// ---------------------------------------------------------------------------
// Pure-function recreation of jobs/index.vue orchestration state
// ---------------------------------------------------------------------------
type PathsExpandedPayload = { jobId: string, hasExpandedPaths: boolean }

function createJobViewState() {
  let expanded: ExpandedState = {}
  let expandAllPathsSignal = 0
  let collapseAllPathsSignal = 0
  const jobsWithExpandedPaths = new Set<string>()

  const hasExpandedJobs = () =>
    expanded === true || Object.keys(expanded).length > 0

  function expandAllJobs() {
    expanded = true
  }
  function collapseAllJobs() {
    expanded = {}
  }
  function expandAllPaths() {
    if (expanded !== true) expanded = true
    expandAllPathsSignal++
  }
  function collapseAllPaths() {
    collapseAllPathsSignal++
  }
  function onPathsExpandedChange(payload: PathsExpandedPayload) {
    if (payload.hasExpandedPaths) {
      jobsWithExpandedPaths.add(payload.jobId)
    } else {
      jobsWithExpandedPaths.delete(payload.jobId)
    }
  }

  return {
    get expanded() { return expanded },
    get expandAllPathsSignal() { return expandAllPathsSignal },
    get collapseAllPathsSignal() { return collapseAllPathsSignal },
    jobsWithExpandedPaths,
    hasExpandedJobs,
    expandAllJobs,
    collapseAllJobs,
    expandAllPaths,
    collapseAllPaths,
    onPathsExpandedChange,
  }
}

// ---------------------------------------------------------------------------
// Pure-function recreation of JobExpandableRow path expansion state
// ---------------------------------------------------------------------------
function createPathExpansionState(pathIds: string[]) {
  let expandedPathIds = new Set<string>()
  const pathDistributions: Record<string, any[]> = {}
  const pathCompletedCounts: Record<string, number> = {}

  function togglePath(pathId: string) {
    if (expandedPathIds.has(pathId)) {
      expandedPathIds = new Set([...expandedPathIds].filter(id => id !== pathId))
    } else {
      expandedPathIds = new Set([...expandedPathIds, pathId])
    }
  }

  async function expandAllPaths(fetchFn: (id: string) => Promise<any>) {
    expandedPathIds = new Set(pathIds)
    const uncachedIds = pathIds.filter(id => !pathDistributions[id])
    const CONCURRENCY = 3
    for (let i = 0; i < uncachedIds.length; i += CONCURRENCY) {
      const batch = uncachedIds.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async (pathId) => {
          const detail = await fetchFn(pathId)
          pathDistributions[pathId] = detail.distribution ?? []
          pathCompletedCounts[pathId] = detail.completedCount ?? 0
        }),
      )
      for (let j = 0; j < batch.length; j++) {
        if (results[j]!.status === 'rejected' && !pathDistributions[batch[j]!]) {
          pathDistributions[batch[j]!] = []
        }
      }
    }
  }

  function collapseAllPaths() {
    expandedPathIds = new Set()
  }

  return {
    get expandedPathIds() { return expandedPathIds },
    pathDistributions,
    pathCompletedCounts,
    togglePath,
    expandAllPaths,
    collapseAllPaths,
  }
}

// ---------------------------------------------------------------------------
// Toolbar disabled-state helper (mirrors JobViewToolbar logic)
// ---------------------------------------------------------------------------
function toolbarDisabledStates(opts: {
  hasExpandedJobs: boolean
  hasExpandedPaths: boolean
  jobCount: number
}) {
  return {
    expandAllJobs: !opts.jobCount,
    collapseAllJobs: !opts.hasExpandedJobs,
    expandAllPaths: !opts.jobCount,
    collapseAllPaths: !opts.hasExpandedPaths,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Job View Utilities – integration', () => {
  // 1. expand-all-jobs sets expanded to true
  describe('expand-all-jobs', () => {
    it('sets expanded to true so hasExpandedJobs returns true', () => {
      const state = createJobViewState()
      expect(state.hasExpandedJobs()).toBe(false)

      state.expandAllJobs()

      expect(state.expanded).toBe(true)
      expect(state.hasExpandedJobs()).toBe(true)
    })
  })

  // 2. collapse-all-jobs sets expanded to {}
  describe('collapse-all-jobs', () => {
    it('sets expanded to {} so hasExpandedJobs returns false', () => {
      const state = createJobViewState()
      state.expandAllJobs()
      expect(state.hasExpandedJobs()).toBe(true)

      state.collapseAllJobs()

      expect(state.expanded).toEqual({})
      expect(state.hasExpandedJobs()).toBe(false)
    })
  })

  // 3. expand-all-paths ensures jobs expanded first, then increments signal
  describe('expand-all-paths', () => {
    it('ensures jobs are expanded first, then increments expandAllPathsSignal', () => {
      const state = createJobViewState()
      // Jobs start collapsed
      expect(state.expanded).toEqual({})
      expect(state.expandAllPathsSignal).toBe(0)

      state.expandAllPaths()

      // Jobs should now be expanded
      expect(state.expanded).toBe(true)
      // Signal should have incremented
      expect(state.expandAllPathsSignal).toBe(1)
    })

    it('does not reset expanded if already true', () => {
      const state = createJobViewState()
      state.expandAllJobs()
      expect(state.expanded).toBe(true)

      state.expandAllPaths()

      expect(state.expanded).toBe(true)
      expect(state.expandAllPathsSignal).toBe(1)
    })
  })

  // 4. expand-all-paths triggers fetches only for uncached paths
  describe('expand-all-paths – selective fetching', () => {
    it('only fetches uncached paths, skips already-cached ones', async () => {
      const pathIds = ['p1', 'p2', 'p3', 'p4']
      const pathState = createPathExpansionState(pathIds)

      // Pre-populate cache for p1 and p3
      pathState.pathDistributions['p1'] = [{ stepId: 's1' }]
      pathState.pathDistributions['p3'] = [{ stepId: 's3' }]

      const fetchFn = vi.fn().mockResolvedValue({
        distribution: [{ stepId: 'mock' }],
        completedCount: 5,
      })

      await pathState.expandAllPaths(fetchFn)

      // Only p2 and p4 should have been fetched
      expect(fetchFn).toHaveBeenCalledTimes(2)
      expect(fetchFn).toHaveBeenCalledWith('p2')
      expect(fetchFn).toHaveBeenCalledWith('p4')

      // All paths should be expanded
      expect(pathState.expandedPathIds.size).toBe(4)

      // Pre-cached data should be untouched
      expect(pathState.pathDistributions['p1']).toEqual([{ stepId: 's1' }])
      expect(pathState.pathDistributions['p3']).toEqual([{ stepId: 's3' }])

      // Newly fetched data should be populated
      expect(pathState.pathDistributions['p2']).toEqual([{ stepId: 'mock' }])
      expect(pathState.pathDistributions['p4']).toEqual([{ stepId: 'mock' }])
    })
  })

  // 5. collapse-all-paths increments signal, leaves jobs expanded
  describe('collapse-all-paths', () => {
    it('increments collapseAllPathsSignal without affecting job expansion', () => {
      const state = createJobViewState()
      state.expandAllJobs()
      expect(state.expanded).toBe(true)
      expect(state.collapseAllPathsSignal).toBe(0)

      state.collapseAllPaths()

      // Jobs still expanded
      expect(state.expanded).toBe(true)
      expect(state.hasExpandedJobs()).toBe(true)
      // Signal incremented
      expect(state.collapseAllPathsSignal).toBe(1)
    })
  })

  // 6. collapse-all-paths preserves pathDistributions cache
  describe('collapse-all-paths – cache preservation', () => {
    it('clears expandedPathIds but preserves pathDistributions cache', async () => {
      const pathIds = ['p1', 'p2']
      const pathState = createPathExpansionState(pathIds)

      const fetchFn = vi.fn().mockResolvedValue({
        distribution: [{ stepId: 'fetched' }],
        completedCount: 3,
      })

      // Expand all → fetches data
      await pathState.expandAllPaths(fetchFn)
      expect(pathState.expandedPathIds.size).toBe(2)
      expect(pathState.pathDistributions['p1']).toEqual([{ stepId: 'fetched' }])
      expect(pathState.pathDistributions['p2']).toEqual([{ stepId: 'fetched' }])

      // Collapse all
      pathState.collapseAllPaths()

      // Paths collapsed
      expect(pathState.expandedPathIds.size).toBe(0)
      // Cache preserved
      expect(pathState.pathDistributions['p1']).toEqual([{ stepId: 'fetched' }])
      expect(pathState.pathDistributions['p2']).toEqual([{ stepId: 'fetched' }])
      expect(pathState.pathCompletedCounts['p1']).toBe(3)
      expect(pathState.pathCompletedCounts['p2']).toBe(3)
    })
  })

  // 7. toolbar disabled states update reactively after operations
  describe('toolbar disabled states', () => {
    it('disables collapse/expand-paths when hasExpandedJobs is false', () => {
      const disabled = toolbarDisabledStates({
        hasExpandedJobs: false,
        hasExpandedPaths: false,
        jobCount: 5,
      })
      expect(disabled.expandAllJobs).toBe(false) // jobs exist, can expand
      expect(disabled.collapseAllJobs).toBe(true) // nothing expanded
      expect(disabled.expandAllPaths).toBe(false) // jobs exist, can expand paths
      expect(disabled.collapseAllPaths).toBe(true) // no paths expanded
    })

    it('enables collapse-jobs and expand-paths after expanding jobs', () => {
      const state = createJobViewState()
      state.expandAllJobs()

      const disabled = toolbarDisabledStates({
        hasExpandedJobs: state.hasExpandedJobs(),
        hasExpandedPaths: state.jobsWithExpandedPaths.size > 0,
        jobCount: 3,
      })
      expect(disabled.collapseAllJobs).toBe(false) // jobs expanded
      expect(disabled.expandAllPaths).toBe(false) // jobs expanded
      expect(disabled.collapseAllPaths).toBe(true) // no paths expanded yet
    })

    it('enables collapse-paths after paths are expanded', () => {
      const state = createJobViewState()
      state.expandAllJobs()
      state.onPathsExpandedChange({ jobId: 'j1', hasExpandedPaths: true })

      const disabled = toolbarDisabledStates({
        hasExpandedJobs: state.hasExpandedJobs(),
        hasExpandedPaths: state.jobsWithExpandedPaths.size > 0,
        jobCount: 3,
      })
      expect(disabled.collapseAllPaths).toBe(false) // paths now expanded
    })

    it('disables all buttons when jobCount is 0', () => {
      const disabled = toolbarDisabledStates({
        hasExpandedJobs: false,
        hasExpandedPaths: false,
        jobCount: 0,
      })
      expect(disabled.expandAllJobs).toBe(true)
      expect(disabled.collapseAllJobs).toBe(true)
      expect(disabled.expandAllPaths).toBe(true)
      expect(disabled.collapseAllPaths).toBe(true)
    })
  })

  // 8. rapid expand-then-collapse results in collapsed state with cache populated
  describe('rapid expand-then-collapse', () => {
    it('results in empty expandedPathIds but cache is populated', async () => {
      const pathIds = ['p1', 'p2', 'p3']
      const pathState = createPathExpansionState(pathIds)

      const fetchFn = vi.fn().mockResolvedValue({
        distribution: [{ stepId: 'data' }],
        completedCount: 1,
      })

      // Expand all (starts fetches)
      const expandPromise = pathState.expandAllPaths(fetchFn)

      // Immediately collapse before fetches resolve
      pathState.collapseAllPaths()

      // Wait for fetches to complete
      await expandPromise

      // Paths should be collapsed (collapse happened after expand set them)
      expect(pathState.expandedPathIds.size).toBe(0)

      // Cache should still be populated from the completed fetches
      expect(Object.keys(pathState.pathDistributions)).toHaveLength(3)
      expect(pathState.pathDistributions['p1']).toEqual([{ stepId: 'data' }])
      expect(pathState.pathDistributions['p2']).toEqual([{ stepId: 'data' }])
      expect(pathState.pathDistributions['p3']).toEqual([{ stepId: 'data' }])
    })
  })

  // 9. onPathsExpandedChange correctly maintains jobsWithExpandedPaths set
  describe('onPathsExpandedChange', () => {
    it('adds jobId when hasExpandedPaths is true', () => {
      const state = createJobViewState()
      state.onPathsExpandedChange({ jobId: 'j1', hasExpandedPaths: true })
      expect(state.jobsWithExpandedPaths.has('j1')).toBe(true)
    })

    it('removes jobId when hasExpandedPaths is false', () => {
      const state = createJobViewState()
      state.onPathsExpandedChange({ jobId: 'j1', hasExpandedPaths: true })
      state.onPathsExpandedChange({ jobId: 'j1', hasExpandedPaths: false })
      expect(state.jobsWithExpandedPaths.has('j1')).toBe(false)
    })

    it('tracks multiple jobs independently', () => {
      const state = createJobViewState()
      state.onPathsExpandedChange({ jobId: 'j1', hasExpandedPaths: true })
      state.onPathsExpandedChange({ jobId: 'j2', hasExpandedPaths: true })
      state.onPathsExpandedChange({ jobId: 'j3', hasExpandedPaths: true })

      expect(state.jobsWithExpandedPaths.size).toBe(3)

      state.onPathsExpandedChange({ jobId: 'j2', hasExpandedPaths: false })

      expect(state.jobsWithExpandedPaths.size).toBe(2)
      expect(state.jobsWithExpandedPaths.has('j1')).toBe(true)
      expect(state.jobsWithExpandedPaths.has('j2')).toBe(false)
      expect(state.jobsWithExpandedPaths.has('j3')).toBe(true)
    })
  })
})
