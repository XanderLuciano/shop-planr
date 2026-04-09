import { ref, computed, watch, onMounted } from 'vue'
import type {
  GroupByDimension,
  WorkQueueFilterState,
  WorkQueueGroup,
  WorkQueuePreset,
} from '~/types/computed'

/** URL query keys managed by the filter composable */
const FILTER_URL_KEYS = ['groupBy', 'filterLocation', 'filterStep', 'filterUser', 'q'] as const

const VALID_GROUP_BY: GroupByDimension[] = ['user', 'location', 'step']

const PRESET_STORAGE_KEY = 'wq-filter-presets'
const MAX_PRESETS = 20

/** Well-known ID for the built-in "My Queue" preset (not deletable). */
export const MY_QUEUE_PRESET_ID = '__my-queue__'

/** Read presets from localStorage. Returns [] on corrupt/missing data. */
function loadPresetsFromStorage(): WorkQueuePreset[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/** Write presets array to localStorage. */
function savePresetsToStorage(presetList: WorkQueuePreset[]): void {
  if (!import.meta.client) return
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presetList))
}

/**
 * Composable that wraps `useOperatorWorkQueue()` and adds:
 * - Group-by dimension selection (user / location / step)
 * - Client-side property filtering + text search
 * - Available filter value extraction
 * - URL synchronization (groupBy, filters, searchQuery ↔ query params)
 * - Saved filter presets (localStorage-backed)
 */
export function useWorkQueueFilters() {
  const route = useRoute()
  const router = useRouter()
  const workQueue = useOperatorWorkQueue()
  const { authenticatedUser } = useAuth()

  // --- Reactive state ---
  const groupBy = ref<GroupByDimension>('location')
  const filters = ref<WorkQueueFilterState>({})
  const searchQuery = ref('')
  const userPresets = ref<WorkQueuePreset[]>([])
  const activePresetId = ref<string | null>(null)

  // --- Built-in "My Queue" preset (always first, not deletable) ---
  const myQueuePreset = computed<WorkQueuePreset | null>(() => {
    const user = authenticatedUser.value
    if (!user) return null
    return {
      id: MY_QUEUE_PRESET_ID,
      name: 'My Queue',
      groupBy: 'location',
      filters: { userId: user.id },
      searchQuery: '',
      createdAt: '',
    }
  })

  /** All presets: built-in "My Queue" first, then user-saved presets. */
  const presets = computed<WorkQueuePreset[]>(() => {
    const builtIn = myQueuePreset.value
    return builtIn ? [builtIn, ...userPresets.value] : [...userPresets.value]
  })

  // --- Raw groups: direct pass-through from the work queue composable ---
  const rawGroups = computed<WorkQueueGroup[]>(() => {
    return workQueue.groups.value
  })

  // --- Computed: filtered groups ---
  const filteredGroups = computed<WorkQueueGroup[]>(() => {
    return applyFilters(rawGroups.value, filters.value, searchQuery.value)
  })

  // --- Computed: active filter count ---
  const activeFilterCount = computed<number>(() => {
    let count = 0
    if (filters.value.location) count++
    if (filters.value.stepName) count++
    if (filters.value.userId) count++
    if (searchQuery.value.trim()) count++
    return count
  })

  // --- Computed: available filter values (from unfiltered data) ---
  const availableValues = computed(() => {
    return extractAvailableValues(rawGroups.value)
  })

  const availableLocations = computed<string[]>(() => availableValues.value.locations)
  const availableSteps = computed<string[]>(() => availableValues.value.stepNames)

  // --- Actions ---

  async function setGroupBy(dimension: GroupByDimension): Promise<void> {
    groupBy.value = dimension
    await workQueue.fetchGroupedWork({ groupBy: dimension })
  }

  function setFilter(key: keyof WorkQueueFilterState, value: string | undefined): void {
    filters.value = { ...filters.value, [key]: value || undefined }
  }

  function clearFilters(): void {
    filters.value = {}
    searchQuery.value = ''
    activePresetId.value = null
  }

  // --- URL synchronization ---

  function syncToUrl(): void {
    const query: Record<string, string | (string | null)[]> = {}

    // Preserve non-filter query params
    for (const [key, value] of Object.entries(route.query)) {
      if (!(FILTER_URL_KEYS as readonly string[]).includes(key)) {
        query[key] = value as string
      }
    }

    // Serialize filter state — omit groupBy when it's the default ('location')
    if (groupBy.value !== 'location') {
      query.groupBy = groupBy.value
    }
    if (filters.value.location) {
      query.filterLocation = filters.value.location
    }
    if (filters.value.stepName) {
      query.filterStep = filters.value.stepName
    }
    if (filters.value.userId) {
      query.filterUser = filters.value.userId
    }
    if (searchQuery.value) {
      query.q = searchQuery.value
    }

    router.replace({ query })
  }

  function syncFromUrl(): void {
    const q = route.query

    // Restore groupBy (validate against allowed values)
    const urlGroupBy = q.groupBy as string | undefined
    if (urlGroupBy && VALID_GROUP_BY.includes(urlGroupBy as GroupByDimension)) {
      groupBy.value = urlGroupBy as GroupByDimension
    }

    // Restore property filters
    const newFilters: WorkQueueFilterState = {}
    if (q.filterLocation) newFilters.location = q.filterLocation as string
    if (q.filterStep) newFilters.stepName = q.filterStep as string
    if (q.filterUser) newFilters.userId = q.filterUser as string
    filters.value = newFilters

    // Restore search query
    if (q.q) {
      searchQuery.value = q.q as string
    }
  }

  // --- Preset management ---

  function savePreset(name: string): void {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 50) return

    const preset: WorkQueuePreset = {
      id: crypto.randomUUID(),
      name: trimmed,
      groupBy: groupBy.value,
      filters: { ...filters.value },
      searchQuery: searchQuery.value,
      createdAt: new Date().toISOString(),
    }

    const current = loadPresetsFromStorage()
    current.push(preset)

    // Cap at 20 — evict oldest (front of array)
    const capped = current.length > MAX_PRESETS
      ? current.slice(current.length - MAX_PRESETS)
      : current

    savePresetsToStorage(capped)
    userPresets.value = capped
    activePresetId.value = preset.id
  }

  async function loadPreset(presetId: string): Promise<void> {
    const preset = presets.value.find(p => p.id === presetId)
    if (!preset) return

    const previousGroupBy = groupBy.value

    groupBy.value = preset.groupBy
    filters.value = { ...preset.filters }
    searchQuery.value = preset.searchQuery
    activePresetId.value = preset.id

    syncToUrl()

    if (preset.groupBy !== previousGroupBy) {
      await workQueue.fetchGroupedWork({ groupBy: preset.groupBy })
    }
  }

  function deletePreset(presetId: string): void {
    // Built-in preset cannot be deleted
    if (presetId === MY_QUEUE_PRESET_ID) return

    const updated = loadPresetsFromStorage().filter(p => p.id !== presetId)
    savePresetsToStorage(updated)
    userPresets.value = updated

    if (activePresetId.value === presetId) {
      activePresetId.value = null
    }
  }

  // --- Watchers: sync state → URL on every change ---
  watch(groupBy, () => syncToUrl())
  watch(filters, () => syncToUrl(), { deep: true })
  watch(searchQuery, () => syncToUrl())

  // --- Apply default state synchronously (before first render) ---
  // Check URL for explicit filter params; if none, apply "My Queue" default.
  // This ensures the filter bar renders with the correct initial state.
  const hasUrlFilters = FILTER_URL_KEYS.some(key => !!route.query[key])
  if (hasUrlFilters) {
    syncFromUrl()
  } else if (myQueuePreset.value) {
    groupBy.value = myQueuePreset.value.groupBy
    filters.value = { ...myQueuePreset.value.filters }
    searchQuery.value = ''
    activePresetId.value = MY_QUEUE_PRESET_ID
  }

  // --- Load user presets from localStorage on mount (client-only) ---
  onMounted(() => {
    if (import.meta.client) {
      userPresets.value = loadPresetsFromStorage()
    }
    // Sync URL to reflect the initial state (safe to call after mount)
    syncToUrl()
  })

  // --- Initial fetch helper ---
  async function init(): Promise<void> {
    await workQueue.fetchGroupedWork({ groupBy: groupBy.value })
  }

  return {
    // State
    groupBy,
    filters,
    searchQuery,
    presets,
    activePresetId,

    // From underlying composable
    loading: workQueue.loading,
    error: workQueue.error,
    totalParts: workQueue.totalParts,

    // Computed
    filteredGroups,
    activeFilterCount,
    availableLocations,
    availableSteps,
    rawGroups,

    // Actions
    setGroupBy,
    setFilter,
    clearFilters,
    init,
    fetchGroupedWork: workQueue.fetchGroupedWork,
    syncToUrl,
    syncFromUrl,

    // Preset actions
    savePreset,
    loadPreset,
    deletePreset,
  }
}
