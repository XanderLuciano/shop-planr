import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { useWorkQueueFilters } from '~/app/composables/useWorkQueueFilters'

/**
 * Unit tests for preset management in useWorkQueueFilters composable.
 *
 * We test the storage helpers and preset logic directly by importing
 * the composable and exercising savePreset / loadPreset / deletePreset.
 *
 * Because the composable calls Nuxt auto-imports (useRoute, useRouter,
 * useOperatorWorkQueue, applyFilters, extractAvailableValues), we mock
 * them at the global level so the composable can be instantiated.
 */

const PRESET_STORAGE_KEY = 'wq-filter-presets'

// --- In-memory localStorage mock ---
let storageMap: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (key: string) => storageMap[key] ?? null,
  setItem: (key: string, value: string) => { storageMap[key] = value },
  removeItem: (key: string) => { delete storageMap[key] },
  clear: () => { storageMap = {} },
  get length() { return Object.keys(storageMap).length },
  key: (index: number) => Object.keys(storageMap)[index] ?? null,
}
vi.stubGlobal('localStorage', mockLocalStorage)

// --- Mocks for Nuxt auto-imports ---

const mockRouteQuery: Record<string, string> = {}
const mockReplace = vi.fn()
const mockFetchGroupedWork = vi.fn().mockResolvedValue(undefined)

vi.stubGlobal('useRoute', () => ({ query: mockRouteQuery }))
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

// Mock useAuth — returns a test user so the built-in "My Queue" preset is generated
const mockAuthUser = { id: 'test-user-1', username: 'testuser', displayName: 'Test User', isAdmin: false, active: true, createdAt: '2024-01-01T00:00:00Z' }
vi.stubGlobal('useAuth', () => ({
  authenticatedUser: { value: mockAuthUser },
  users: { value: [] },
}))

// Auto-imported constant from composable
vi.stubGlobal('MY_QUEUE_PRESET_ID', '__my-queue__')

// Stable UUID counter for deterministic tests
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})

describe('useWorkQueueFilters — preset management', () => {
  // Suppress Vue's "onMounted called outside component" warning — the composable's
  // onMounted is a no-op in tests and doesn't affect preset logic.
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    storageMap = {}
    uuidCounter = 0
    mockFetchGroupedWork.mockClear()
    mockReplace.mockClear()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  // --- savePreset ---

  describe('savePreset', () => {
    it('saves a preset to localStorage and updates reactive state', () => {
      const { savePreset, presets, activePresetId } = useWorkQueueFilters()

      savePreset('My Preset')

      // presets includes built-in "My Queue" at [0] + user preset at [1]
      expect(presets.value).toHaveLength(2)
      expect(presets.value[0].name).toBe('My Queue')
      expect(presets.value[1].name).toBe('My Preset')
      expect(presets.value[1].id).toBe('test-uuid-1')
      expect(presets.value[1].groupBy).toBe('location')
      expect(presets.value[1].searchQuery).toBe('')
      expect(activePresetId.value).toBe('test-uuid-1')

      // Verify localStorage (only user presets are stored)
      const stored = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY)!)
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('My Preset')
    })

    it('trims the preset name', () => {
      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('  Trimmed Name  ')

      expect(presets.value[1].name).toBe('Trimmed Name')
    })

    it('returns early for empty name', () => {
      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('')
      savePreset('   ')

      // Only the built-in preset
      expect(presets.value).toHaveLength(1)
      expect(localStorage.getItem(PRESET_STORAGE_KEY)).toBeNull()
    })

    it('returns early for name exceeding 50 characters', () => {
      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('A'.repeat(51))

      expect(presets.value).toHaveLength(1) // only built-in
    })

    it('accepts name of exactly 50 characters', () => {
      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('A'.repeat(50))

      expect(presets.value).toHaveLength(2)
      expect(presets.value[1].name).toBe('A'.repeat(50))
    })

    it('captures current filter state in the preset', () => {
      const { savePreset, presets, filters, searchQuery, groupBy } = useWorkQueueFilters()

      groupBy.value = 'step'
      filters.value = { location: 'CNC Bay 1', stepName: 'Deburr' }
      searchQuery.value = 'bracket'

      savePreset('Step Filters')

      expect(presets.value[1].groupBy).toBe('step')
      expect(presets.value[1].filters).toEqual({ location: 'CNC Bay 1', stepName: 'Deburr' })
      expect(presets.value[1].searchQuery).toBe('bracket')
    })

    it('caps at 20 user presets, evicting oldest', () => {
      const { savePreset, presets } = useWorkQueueFilters()

      for (let i = 1; i <= 21; i++) {
        savePreset(`Preset ${i}`)
      }

      // 1 built-in + 20 user presets
      expect(presets.value).toHaveLength(21)
      // Oldest (Preset 1) should be evicted; Preset 2 is now first user preset
      expect(presets.value[0].name).toBe('My Queue')
      expect(presets.value[1].name).toBe('Preset 2')
      expect(presets.value[20].name).toBe('Preset 21')
    })

    it('stores a createdAt ISO timestamp', () => {
      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('Timestamped')

      const createdAt = presets.value[1].createdAt
      expect(() => new Date(createdAt)).not.toThrow()
      expect(new Date(createdAt).toISOString()).toBe(createdAt)
    })
  })

  // --- loadPreset ---

  describe('loadPreset', () => {
    it('restores groupBy, filters, and searchQuery from a saved preset', async () => {
      const { savePreset, loadPreset, groupBy, filters, searchQuery, activePresetId } = useWorkQueueFilters()

      // Save with specific state
      groupBy.value = 'user'
      filters.value = { userId: 'op-1' }
      searchQuery.value = 'bolt'
      savePreset('User View')

      // Change state
      groupBy.value = 'location'
      filters.value = {}
      searchQuery.value = ''

      // Load the preset
      await loadPreset('test-uuid-1')

      expect(groupBy.value).toBe('user')
      expect(filters.value).toEqual({ userId: 'op-1' })
      expect(searchQuery.value).toBe('bolt')
      expect(activePresetId.value).toBe('test-uuid-1')
    })

    it('triggers API re-fetch when groupBy changes', async () => {
      const { savePreset, loadPreset, groupBy } = useWorkQueueFilters()

      groupBy.value = 'step'
      savePreset('Step View')

      groupBy.value = 'location'
      mockFetchGroupedWork.mockClear()

      await loadPreset('test-uuid-1')

      expect(mockFetchGroupedWork).toHaveBeenCalledWith({ groupBy: 'step' })
    })

    it('does NOT re-fetch when groupBy is unchanged', async () => {
      const { savePreset, loadPreset, groupBy } = useWorkQueueFilters()

      groupBy.value = 'location'
      savePreset('Location View')

      mockFetchGroupedWork.mockClear()

      await loadPreset('test-uuid-1')

      expect(mockFetchGroupedWork).not.toHaveBeenCalled()
    })

    it('does nothing for unknown preset ID', async () => {
      const { loadPreset, groupBy } = useWorkQueueFilters()

      groupBy.value = 'location'
      await loadPreset('nonexistent-id')

      expect(groupBy.value).toBe('location')
      expect(mockFetchGroupedWork).not.toHaveBeenCalled()
    })

    it('calls syncToUrl after loading', async () => {
      const { savePreset, loadPreset } = useWorkQueueFilters()

      savePreset('Test')
      mockReplace.mockClear()

      await loadPreset('test-uuid-1')

      expect(mockReplace).toHaveBeenCalled()
    })
  })

  // --- deletePreset ---

  describe('deletePreset', () => {
    it('removes a preset from localStorage and reactive state', () => {
      const { savePreset, deletePreset, presets } = useWorkQueueFilters()

      savePreset('To Delete')
      expect(presets.value).toHaveLength(2) // built-in + user

      deletePreset('test-uuid-1')

      expect(presets.value).toHaveLength(1) // only built-in remains
      const stored = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY)!)
      expect(stored).toHaveLength(0)
    })

    it('clears activePresetId when deleting the active preset', () => {
      const { savePreset, deletePreset, activePresetId } = useWorkQueueFilters()

      savePreset('Active One')
      expect(activePresetId.value).toBe('test-uuid-1')

      deletePreset('test-uuid-1')

      expect(activePresetId.value).toBeNull()
    })

    it('does NOT clear activePresetId when deleting a different preset', () => {
      const { savePreset, deletePreset, activePresetId } = useWorkQueueFilters()

      savePreset('First')
      savePreset('Second')
      // activePresetId is now test-uuid-2 (the last saved)
      expect(activePresetId.value).toBe('test-uuid-2')

      deletePreset('test-uuid-1')

      expect(activePresetId.value).toBe('test-uuid-2')
    })

    it('does nothing for unknown preset ID', () => {
      const { savePreset, deletePreset, presets } = useWorkQueueFilters()

      savePreset('Keep Me')

      deletePreset('nonexistent')

      expect(presets.value).toHaveLength(2) // built-in + user
    })

    it('does not delete the built-in My Queue preset', () => {
      const { deletePreset, presets } = useWorkQueueFilters()

      deletePreset('__my-queue__')

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0].id).toBe('__my-queue__')
    })
  })

  // --- Corrupt localStorage ---

  describe('corrupt localStorage handling', () => {
    it('returns empty array when localStorage has invalid JSON', () => {
      localStorage.setItem(PRESET_STORAGE_KEY, '{not valid json')

      const { presets, savePreset } = useWorkQueueFilters()

      // savePreset reads from storage internally — should not throw
      savePreset('After Corrupt')

      // built-in + 1 user preset
      expect(presets.value).toHaveLength(2)
      expect(presets.value[1].name).toBe('After Corrupt')
    })

    it('returns empty array when localStorage has non-array JSON', () => {
      localStorage.setItem(PRESET_STORAGE_KEY, '{"not": "an array"}')

      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('After Object')

      expect(presets.value).toHaveLength(2) // built-in + user
    })

    it('returns empty array when localStorage has null value', () => {
      // No key set at all
      const { savePreset, presets } = useWorkQueueFilters()

      savePreset('Fresh Start')

      expect(presets.value).toHaveLength(2) // built-in + user
    })
  })
})
