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

/** Read presets from localStorage. Returns [] on corrupt/missing data. */
function loadPresetsFromStorage(): WorkQueuePreset[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  }
  catch {
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

  // --- Reactive state ---
  const groupBy = ref<GroupByDimension>('location')
  const filters = ref<WorkQueueFilterState>({})
  const searchQuery = ref('')
  const presets = ref<WorkQueuePreset[]>([])
  const activePresetId = ref<string | null>(null)

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

    // Preserve non-filter query params (e.g. operator)
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
    presets.value = capped
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
    const updated = loadPresetsFromStorage().filter(p => p.id !== presetId)
    savePresetsToStorage(updated)
    presets.value = updated

    if (activePresetId.value === presetId) {
      activePresetId.value = null
    }
  }

  // --- Watchers: sync state → URL on every change ---
  watch(groupBy, () => syncToUrl())
  watch(filters, () => syncToUrl(), { deep: true })
  watch(searchQuery, () => syncToUrl())

  // --- Restore from URL + load presets on mount ---
  onMounted(() => {
    syncFromUrl()
    if (import.meta.client) {
      presets.value = loadPresetsFromStorage()
    }
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
