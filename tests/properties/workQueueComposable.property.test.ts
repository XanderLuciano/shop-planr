/**
 * Property Tests for useWorkQueueFilters Composable
 *
 * Tests the composable's URL round-trip, search backward compatibility,
 * preset round-trip, and preset capacity properties.
 *
 * Properties tested:
 *   CP-WQF-5: URL State Round-Trip
 *   CP-WQF-7: Search Backward Compatibility
 *   CP-WQF-8: Preset Round-Trip
 *   CP-WQF-9: Preset Capacity
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import type {
  GroupByDimension,
  WorkQueueFilterState,
  WorkQueueGroup,
  WorkQueueJob,
} from '~/server/types/computed'

// Import composable AFTER mocks are in place
import { useWorkQueueFilters } from '~/app/composables/useWorkQueueFilters'
// Import the real pure function for CP-WQF-7
import { applyFilters as realApplyFilters } from '~/app/utils/workQueueFilters'

// ---------------------------------------------------------------------------
// Mocks — must be set up BEFORE importing the composable
// ---------------------------------------------------------------------------

let routeQuery: Record<string, string> = {}
let storageMap: Record<string, string> = {}
let uuidCounter = 0

const mockReplace = vi.fn()
const mockFetchGroupedWork = vi.fn().mockResolvedValue(undefined)

vi.stubGlobal('useRoute', () => ({ query: routeQuery }))
vi.stubGlobal('useRouter', () => ({ replace: mockReplace }))
vi.stubGlobal('useOperatorWorkQueue', () => ({
  groups: { value: [] },
  loading: { value: false },
  error: { value: null },
  totalParts: { value: 0 },
  fetchGroupedWork: mockFetchGroupedWork,
}))
vi.stubGlobal('applyFilters', (groups: any[]) => groups)
vi.stubGlobal('extractAvailableValues', () => ({ locations: [], stepNames: [], userIds: [] }))
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storageMap[key] ?? null,
  setItem: (key: string, value: string) => { storageMap[key] = value },
  removeItem: (key: string) => { delete storageMap[key] },
  clear: () => { storageMap = {} },
  get length() { return Object.keys(storageMap).length },
  key: (index: number) => Object.keys(storageMap)[index] ?? null,
})

// ---------------------------------------------------------------------------
// Shared arbitrary generators
// ---------------------------------------------------------------------------

const arbGroupByDimension = (): fc.Arbitrary<GroupByDimension> =>
  fc.constantFrom('user' as const, 'location' as const, 'step' as const)

const arbFilterState = (): fc.Arbitrary<WorkQueueFilterState> =>
  fc.record({
    location: fc.option(
      fc.constantFrom('CNC Bay 1', 'Assembly', 'Welding', 'QC Area', 'Shipping'),
      { nil: undefined, freq: 3 },
    ),
    stepName: fc.option(
      fc.constantFrom('Deburr', 'QC Check', 'Assembly', 'Weld', 'Paint', 'Pack', 'Inspect'),
      { nil: undefined, freq: 3 },
    ),
    userId: fc.option(
      fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4'),
      { nil: undefined, freq: 3 },
    ),
  })

const arbSearchQuery = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-zA-Z0-9]{0,10}$/)

/** Preset name: non-empty after trimming, ≤50 chars. Must contain at least one non-space char. */
const arbPresetName = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[A-Za-z0-9 ]{1,30}$/).filter(s => s.trim().length > 0)

// ===========================================================================
// CP-WQF-5: URL State Round-Trip (Task 5.4)
// ===========================================================================

describe('Property 5: URL State Round-Trip (CP-WQF-5)', () => {
  beforeEach(() => {
    routeQuery = {}
    storageMap = {}
    uuidCounter = 0
    mockReplace.mockReset()
    mockFetchGroupedWork.mockReset()
  })

  /**
   * **Validates: Requirement 6.6**
   *
   * Serializing filter state to URL params and deserializing back
   * produces the original state.
   */
  it('serialize → deserialize round-trip preserves groupBy, filters, and searchQuery', () => {
    fc.assert(
      fc.property(
        arbGroupByDimension(),
        arbFilterState(),
        arbSearchQuery(),
        (groupByVal, filtersVal, searchVal) => {
          mockReplace.mockReset()
          const wq = useWorkQueueFilters()

          // 1. Set state
          wq.groupBy.value = groupByVal
          wq.filters.value = { ...filtersVal }
          wq.searchQuery.value = searchVal

          // 2. Serialize to URL
          wq.syncToUrl()

          // 3. Extract what syncToUrl wrote via router.replace
          const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1]
          const serializedQuery = lastCall[0].query as Record<string, string>

          // 4. Simulate page load: set route query to serialized params
          Object.keys(routeQuery).forEach(k => delete routeQuery[k])
          Object.assign(routeQuery, serializedQuery)

          // 5. Reset composable state to defaults
          wq.groupBy.value = 'location'
          wq.filters.value = {}
          wq.searchQuery.value = ''

          // 6. Deserialize from URL
          wq.syncFromUrl()

          // 7. Verify round-trip
          expect(wq.groupBy.value).toBe(groupByVal)

          const expectedLocation = filtersVal.location || undefined
          const expectedStepName = filtersVal.stepName || undefined
          const expectedUserId = filtersVal.userId || undefined
          expect(wq.filters.value.location).toBe(expectedLocation)
          expect(wq.filters.value.stepName).toBe(expectedStepName)
          expect(wq.filters.value.userId).toBe(expectedUserId)

          if (searchVal) {
            expect(wq.searchQuery.value).toBe(searchVal)
          } else {
            expect(wq.searchQuery.value).toBe('')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ===========================================================================
// CP-WQF-7: Search Backward Compatibility (Task 5.5)
// ===========================================================================

describe('Property 7: Search Backward Compatibility (CP-WQF-7)', () => {
  /**
   * **Validates: Requirement 10.3**
   *
   * Any text search matching a job via existing fields (jobName, stepName)
   * also matches in the new system.
   */
  it('search matching jobName or stepName always includes that job in results', () => {
    const arbJob = (): fc.Arbitrary<WorkQueueJob> =>
      fc.record({
        jobId: fc.stringMatching(/^[a-z]{3,6}$/),
        jobName: fc.constantFrom('Bracket Assembly', 'Lock Body', 'Control Board', 'Shaft Mount'),
        pathId: fc.stringMatching(/^[a-z]{3,6}$/),
        pathName: fc.constant('Main'),
        stepId: fc.stringMatching(/^[a-z]{3,6}$/),
        stepName: fc.constantFrom('Deburr', 'QC Check', 'Assembly', 'Weld', 'Paint'),
        stepOrder: fc.integer({ min: 1, max: 5 }),
        stepLocation: fc.option(
          fc.constantFrom('CNC Bay 1', 'Assembly'),
          { nil: undefined, freq: 3 },
        ),
        totalSteps: fc.integer({ min: 1, max: 5 }),
        partIds: fc.constant(['p1'] as readonly string[]),
        partCount: fc.integer({ min: 1, max: 10 }),
        isFinalStep: fc.boolean(),
        jobPriority: fc.integer({ min: 0, max: 100 }),
      }) as fc.Arbitrary<WorkQueueJob>

    fc.assert(
      fc.property(
        arbJob(),
        fc.constantFrom('user' as const, 'location' as const, 'step' as const),
        (job, groupType) => {
          const group: WorkQueueGroup = {
            groupKey: 'test-key',
            groupLabel: 'Test Group',
            groupType,
            jobs: [job],
            totalParts: job.partCount,
          }

          // Search by substring of jobName (first 3 chars, lowercased)
          const jobNameQuery = job.jobName.substring(0, 3).toLowerCase()
          const resultByJobName = realApplyFilters([group], {}, jobNameQuery)
          const jobNameJobs = resultByJobName.flatMap((g: WorkQueueGroup) => g.jobs)
          expect(jobNameJobs).toContain(job)

          // Search by substring of stepName (first 3 chars, lowercased)
          const stepNameQuery = job.stepName.substring(0, 3).toLowerCase()
          const resultByStepName = realApplyFilters([group], {}, stepNameQuery)
          const stepNameJobs = resultByStepName.flatMap((g: WorkQueueGroup) => g.jobs)
          expect(stepNameJobs).toContain(job)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ===========================================================================
// CP-WQF-8: Preset Round-Trip (Task 5.6)
// ===========================================================================

describe('Property 8: Preset Round-Trip (CP-WQF-8)', () => {
  beforeEach(() => {
    routeQuery = {}
    storageMap = {}
    uuidCounter = 0
    mockReplace.mockReset()
    mockFetchGroupedWork.mockReset()
  })

  /**
   * **Validates: Requirements 7.3, 7.4**
   *
   * Saving filter state as preset and loading it restores exact same values.
   */
  it('save → load round-trip preserves groupBy, filters, and searchQuery', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbGroupByDimension(),
        arbFilterState(),
        arbSearchQuery(),
        arbPresetName(),
        async (groupByVal, filtersVal, searchVal, presetName) => {
          // Reset storage between iterations
          storageMap = {}
          uuidCounter = 0

          const wq = useWorkQueueFilters()

          // 1. Set state
          wq.groupBy.value = groupByVal
          wq.filters.value = { ...filtersVal }
          wq.searchQuery.value = searchVal

          // 2. Save preset
          wq.savePreset(presetName)

          expect(wq.presets.value).toHaveLength(1)
          const savedId = wq.presets.value[0].id

          // 3. Change state to something different
          wq.groupBy.value = 'location'
          wq.filters.value = {}
          wq.searchQuery.value = ''

          // 4. Load the preset
          await wq.loadPreset(savedId)

          // 5. Verify round-trip
          expect(wq.groupBy.value).toBe(groupByVal)
          expect(wq.filters.value.location).toBe(filtersVal.location || undefined)
          expect(wq.filters.value.stepName).toBe(filtersVal.stepName || undefined)
          expect(wq.filters.value.userId).toBe(filtersVal.userId || undefined)
          expect(wq.searchQuery.value).toBe(searchVal)
          expect(wq.activePresetId.value).toBe(savedId)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ===========================================================================
// CP-WQF-9: Preset Capacity (Task 5.7)
// ===========================================================================

describe('Property 9: Preset Capacity (CP-WQF-9)', () => {
  beforeEach(() => {
    routeQuery = {}
    storageMap = {}
    uuidCounter = 0
    mockReplace.mockReset()
    mockFetchGroupedWork.mockReset()
  })

  /**
   * **Validates: Requirement 7.5**
   *
   * Presets array length never exceeds 20; 21st save evicts oldest.
   */
  it('presets never exceed 20; saving beyond 20 evicts the oldest', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (saveCount) => {
          // Reset storage between iterations
          storageMap = {}
          uuidCounter = 0

          const wq = useWorkQueueFilters()

          // Save N presets
          for (let i = 1; i <= saveCount; i++) {
            wq.savePreset(`Preset ${i}`)
          }

          // Capacity invariant: never more than 20
          expect(wq.presets.value.length).toBeLessThanOrEqual(20)

          if (saveCount > 20) {
            expect(wq.presets.value).toHaveLength(20)

            // Oldest should be evicted: first preset name = "Preset <saveCount - 19>"
            const expectedOldestName = `Preset ${saveCount - 19}`
            expect(wq.presets.value[0].name).toBe(expectedOldestName)

            // Newest should be the last saved
            expect(wq.presets.value[19].name).toBe(`Preset ${saveCount}`)
          } else {
            expect(wq.presets.value).toHaveLength(saveCount)
          }

          // Verify localStorage matches reactive state
          const stored = JSON.parse(storageMap['wq-filter-presets'] ?? '[]')
          expect(stored).toHaveLength(wq.presets.value.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})
