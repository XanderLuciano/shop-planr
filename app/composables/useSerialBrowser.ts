import { ref, computed, readonly } from 'vue'
import type { EnrichedSerial } from '~/server/types/computed'

// ---- Filter types ----

export interface SerialBrowserFilters {
  jobName?: string
  pathName?: string
  stepName?: string
  status?: 'in-progress' | 'completed' | 'all'
  assignee?: string // user name or 'Unassigned'
}

// ---- Pure functions (exported for property testing) ----

/**
 * Search serials by id — case-insensitive partial match.
 * Empty query returns all.
 */
export function searchSerials(serials: EnrichedSerial[], query: string): EnrichedSerial[] {
  const q = query.trim().toLowerCase()
  if (!q) return serials
  return serials.filter(s => s.id.toLowerCase().includes(q))
}

/**
 * Filter serials with AND logic across all active criteria.
 * Empty/undefined/all filters pass through.
 * "Unassigned" assignee matches undefined/null assignedTo.
 */
export function filterSerials(serials: EnrichedSerial[], filters: SerialBrowserFilters): EnrichedSerial[] {
  return serials.filter((s) => {
    if (filters.jobName && s.jobName !== filters.jobName) return false
    if (filters.pathName && s.pathName !== filters.pathName) return false
    if (filters.stepName && s.currentStepName !== filters.stepName) return false
    if (filters.status && filters.status !== 'all' && s.status !== filters.status) return false
    if (filters.assignee) {
      if (filters.assignee === 'Unassigned') {
        if (s.assignedTo != null && s.assignedTo !== '') return false
      } else {
        if (s.assignedTo !== filters.assignee) return false
      }
    }
    return true
  })
}

/**
 * Sort serials by column. Returns a new sorted array.
 */
export function sortSerials(
  serials: EnrichedSerial[],
  column: string,
  direction: 'asc' | 'desc',
): EnrichedSerial[] {
  const sorted = [...serials]
  const dir = direction === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    const aVal = String((a as any)[column] ?? '')
    const bVal = String((b as any)[column] ?? '')
    return aVal.localeCompare(bVal) * dir
  })
  return sorted
}

// ---- Composable ----

export function useSerialBrowser() {
  const serials = ref<EnrichedSerial[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const filters = ref<SerialBrowserFilters>({})
  const sortColumn = ref<string>('id')
  const sortDirection = ref<'asc' | 'desc'>('asc')

  const filteredSerials = computed<EnrichedSerial[]>(() => {
    let result = serials.value
    result = searchSerials(result, searchQuery.value)
    result = filterSerials(result, filters.value)
    result = sortSerials(result, sortColumn.value, sortDirection.value)
    return result
  })

  const totalCount = computed(() => serials.value.length)
  const filteredCount = computed(() => filteredSerials.value.length)

  async function fetchSerials(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      serials.value = await $fetch<EnrichedSerial[]>('/api/serials')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch serials'
      serials.value = []
    } finally {
      loading.value = false
    }
  }

  function setSort(column: string): void {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn.value = column
      sortDirection.value = 'asc'
    }
  }

  return {
    serials: readonly(serials),
    loading: readonly(loading),
    error: readonly(error),
    searchQuery,
    filters,
    sortColumn,
    sortDirection,
    filteredSerials,
    totalCount,
    filteredCount,
    fetchSerials,
    setSort,
  }
}
