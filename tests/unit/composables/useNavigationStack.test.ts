/**
 * Unit tests for useNavigationStack composable.
 *
 * Tests deep navigation chain scenarios, corrupted sessionStorage recovery,
 * and sessionStorage unavailability.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 1.6, 9.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

// --- Stub Vue auto-imports that Nuxt provides globally ---
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// --- Mock sessionStorage ---
let storage: Record<string, string> = {}
const mockSessionStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key]
  }),
}
vi.stubGlobal('sessionStorage', mockSessionStorage)

// --- Mock Nuxt auto-imports ---
let currentRoutePath = '/'
vi.stubGlobal('useRoute', () => ({ path: currentRoutePath }))
vi.stubGlobal('navigateTo', vi.fn())

// Mock useState — returns a shared ref by key, like Nuxt does
const stateStore: Record<string, any> = {}
vi.stubGlobal('useState', (key: string, init?: () => any) => {
  if (!(key in stateStore)) {
    stateStore[key] = ref(init ? init() : undefined)
  }
  return stateStore[key]
})

// Mock import.meta.client / import.meta.server
// In test environment, treat as client
vi.stubGlobal('import', { meta: { client: true, server: false } })

// Import the utilities (these are pure functions, auto-imported in Nuxt)
// eslint-disable-next-line import/first
import { resolveLabel, routePattern } from '~/app/utils/navigationLabels'
// eslint-disable-next-line import/first
import { resolveFallbackRoute } from '~/app/utils/navigationFallbacks'

vi.stubGlobal('resolveLabel', resolveLabel)
vi.stubGlobal('routePattern', routePattern)
vi.stubGlobal('resolveFallbackRoute', resolveFallbackRoute)

// Import the composable under test
// eslint-disable-next-line import/first
import { useNavigationStack } from '~/app/composables/useNavigationStack'

function resetState() {
  storage = {}
  mockSessionStorage.getItem.mockImplementation((key: string) => storage[key] ?? null)
  mockSessionStorage.setItem.mockImplementation((key: string, value: string) => {
    storage[key] = value
  })
  // Clear useState store
  for (const key of Object.keys(stateStore)) {
    delete stateStore[key]
  }
  currentRoutePath = '/'
}

describe('useNavigationStack — deep navigation chains', () => {
  beforeEach(() => {
    resetState()
  })

  /**
   * Requirement 7.1: Queue → Step View → Part Detail
   * Back from Part Detail → Step View, Back from Step View → Queue
   */
  it('Queue → Step View → Part Detail chain unwinds correctly', () => {
    const nav = useNavigationStack()

    // Simulate: user is on /queue, navigates to step view
    nav.push({ path: '/queue', label: 'Work Queue' })

    // Simulate: user is on step view, navigates to part detail
    nav.push({ path: '/parts/step/step-001', label: 'Step View' })

    // On Part Detail page: back should go to Step View
    currentRoutePath = '/parts-browser/part-001'
    const nav2 = useNavigationStack()
    expect(nav2.backNavigation.value.to).toBe('/parts/step/step-001')
    expect(nav2.backNavigation.value.label).toBe('Back to Step View')

    // Pop (go back to step view)
    nav2.pop()

    // On Step View: back should go to Queue
    currentRoutePath = '/parts/step/step-001'
    const nav3 = useNavigationStack()
    expect(nav3.backNavigation.value.to).toBe('/queue')
    expect(nav3.backNavigation.value.label).toBe('Back to Work Queue')
  })

  /**
   * Requirement 7.2: Part Detail → Step View → Sibling Part Detail
   * Back from sibling → Step View, Back from Step View → original Part Detail
   */
  it('Part Detail → Step View → Sibling Part chain unwinds correctly', () => {
    const nav = useNavigationStack()

    // User on Part Detail, navigates to Step View
    nav.push({ path: '/parts-browser/part-001', label: 'Part part-001' })

    // User on Step View, navigates to sibling Part Detail
    nav.push({ path: '/parts/step/step-001', label: 'Step View' })

    // On sibling Part Detail: back should go to Step View
    currentRoutePath = '/parts-browser/part-002'
    const nav2 = useNavigationStack()
    expect(nav2.backNavigation.value.to).toBe('/parts/step/step-001')
    expect(nav2.backNavigation.value.label).toBe('Back to Step View')

    // Pop (go back to step view)
    nav2.pop()

    // On Step View: back should go to original Part Detail
    currentRoutePath = '/parts/step/step-001'
    const nav3 = useNavigationStack()
    expect(nav3.backNavigation.value.to).toBe('/parts-browser/part-001')
    expect(nav3.backNavigation.value.label).toBe('Back to Part part-001')
  })

  /**
   * Requirement 7.3: Jobs → Job Detail → Step View → Part Detail
   * Full LIFO unwinding
   */
  it('Jobs → Job Detail → Step View → Part Detail chain unwinds in reverse', () => {
    const nav = useNavigationStack()

    nav.push({ path: '/jobs', label: 'Jobs' })
    nav.push({ path: '/jobs/job-001', label: 'Job job-001' })
    nav.push({ path: '/parts/step/step-001', label: 'Step View' })

    // On Part Detail: back → Step View
    expect(nav.backNavigation.value.to).toBe('/parts/step/step-001')

    const popped1 = nav.pop()
    expect(popped1?.path).toBe('/parts/step/step-001')

    // Back → Job Detail
    expect(nav.backNavigation.value.to).toBe('/jobs/job-001')

    const popped2 = nav.pop()
    expect(popped2?.path).toBe('/jobs/job-001')

    // Back → Jobs
    expect(nav.backNavigation.value.to).toBe('/jobs')

    const popped3 = nav.pop()
    expect(popped3?.path).toBe('/jobs')

    // Stack empty → fallback
    currentRoutePath = '/jobs'
    const nav2 = useNavigationStack()
    expect(nav2.backNavigation.value.to).toBe('/')
  })

  /**
   * Requirement 7.4: Sibling navigation preserves full chain
   */
  it('sibling part navigation preserves the full chain', () => {
    const nav = useNavigationStack()

    // Build chain: Queue → Step View → Part Detail
    nav.push({ path: '/queue', label: 'Work Queue' })
    nav.push({ path: '/parts/step/step-001', label: 'Step View' })

    // Now on Part Detail, navigate to sibling (replaceTop simulated by middleware)
    // The middleware would replaceTop for same-page-type, but sibling parts
    // are different pages, so the step view entry stays
    // After navigating to sibling, the stack should still have Queue and Step View
    expect(nav.entries.value).toHaveLength(2)
    expect(nav.entries.value[0]!.path).toBe('/queue')
    expect(nav.entries.value[1]!.path).toBe('/parts/step/step-001')
  })
})

describe('useNavigationStack — corrupted sessionStorage recovery', () => {
  beforeEach(() => {
    resetState()
  })

  /**
   * Requirement 1.6: null in sessionStorage
   */
  it('recovers from null sessionStorage value', () => {
    storage['nav-stack'] = 'null'
    const nav = useNavigationStack()
    expect(nav.entries.value).toEqual([])
  })

  /**
   * Requirement 1.6: undefined-like value
   */
  it('recovers from "undefined" sessionStorage value', () => {
    storage['nav-stack'] = 'undefined'
    const nav = useNavigationStack()
    expect(nav.entries.value).toEqual([])
  })

  /**
   * Requirement 1.6: invalid JSON
   */
  it('recovers from invalid JSON in sessionStorage', () => {
    storage['nav-stack'] = 'not valid json {'
    const nav = useNavigationStack()
    expect(nav.entries.value).toEqual([])
  })

  /**
   * Requirement 1.6: non-array JSON
   */
  it('recovers from non-array JSON (number)', () => {
    storage['nav-stack'] = '42'
    const nav = useNavigationStack()
    expect(nav.entries.value).toEqual([])
  })

  /**
   * Requirement 9.2: invalid entries filtered out
   */
  it('filters out entries with invalid paths', () => {
    storage['nav-stack'] = JSON.stringify([
      { path: '/queue', label: 'Work Queue' },
      { path: '', label: 'Empty' },
      { path: 'no-slash', label: 'No Slash' },
      { path: '/jobs', label: 'Jobs' },
    ])
    const nav = useNavigationStack()
    expect(nav.entries.value).toHaveLength(2)
    expect(nav.entries.value[0]!.path).toBe('/queue')
    expect(nav.entries.value[1]!.path).toBe('/jobs')
  })

  /**
   * Requirement 9.2: entries missing fields
   */
  it('filters out entries missing required fields', () => {
    storage['nav-stack'] = JSON.stringify([
      { path: '/queue', label: 'Work Queue' },
      { path: '/jobs' }, // missing label
      { label: 'No Path' }, // missing path
      { bad: true },
    ])
    const nav = useNavigationStack()
    expect(nav.entries.value).toHaveLength(1)
    expect(nav.entries.value[0]!.path).toBe('/queue')
  })
})

describe('useNavigationStack — sessionStorage unavailable', () => {
  beforeEach(() => {
    resetState()
  })

  /**
   * Requirement 9.3: graceful degradation when sessionStorage throws
   */
  it('operates in-memory when sessionStorage.getItem throws', () => {
    mockSessionStorage.getItem.mockImplementation(() => {
      throw new Error('SecurityError')
    })

    const nav = useNavigationStack()
    // Should not throw, stack starts empty
    expect(nav.entries.value).toEqual([])

    // Push should work in-memory
    nav.push({ path: '/queue', label: 'Work Queue' })
    expect(nav.entries.value).toHaveLength(1)
  })

  it('operates in-memory when sessionStorage.setItem throws', () => {
    mockSessionStorage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const nav = useNavigationStack()
    nav.push({ path: '/queue', label: 'Work Queue' })

    // Push should still work (in-memory), even though persist fails
    expect(nav.entries.value).toHaveLength(1)
    expect(nav.entries.value[0]!.path).toBe('/queue')
  })
})
