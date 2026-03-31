import { ref, computed, readonly } from 'vue'
import type { EnrichedPart } from '~/types/computed'

// ---- Filter types ----

export interface PartBrowserFilters {
  jobName?: string
  pathName?: string
  stepName?: string
  status?: 'in-progress' | 'completed' | 'all'
  assignee?: string // user name or 'Unassigned'
}

// ---- Pure functions (exported for property testing) ----

/**
 * Search parts by id — case-insensitive partial match.
 * Empty query returns all.
 */
export function searchParts(parts: EnrichedPart[], query: string): EnrichedPart[] {
  const q = query.trim().toLowerCase()
  if (!q) return parts
  return parts.filter(s => s.id.toLowerCase().includes(q))
}

/**
 * Filter parts with AND logic across all active criteria.
 * Empty/undefined/all filters pass through.
 * "Unassigned" assignee matches undefined/null assignedTo.
 */
export function filterParts(parts: EnrichedPart[], filters: PartBrowserFilters): EnrichedPart[] {
  return parts.filter((s) => {
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
 * Sort parts by column. Returns a new sorted array.
 */
export function sortParts(
  parts: EnrichedPart[],
  column: keyof EnrichedPart,
  direction: 'asc' | 'desc',
): EnrichedPart[] {
  const sorted = [...parts]
  const dir = direction === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    const aVal = String(a[column] ?? '')
    const bVal = String(b[column] ?? '')
    return aVal.localeCompare(bVal) * dir
  })
  return sorted
}

// ---- Composable ----

export function usePartBrowser() {
  const parts = ref<EnrichedPart[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const filters = ref<PartBrowserFilters>({})
  const sortColumn = ref<keyof EnrichedPart>('id')
  const sortDirection = ref<'asc' | 'desc'>('asc')

  const filteredParts = computed<EnrichedPart[]>(() => {
    let result = parts.value
    result = searchParts(result, searchQuery.value)
    result = filterParts(result, filters.value)
    result = sortParts(result, sortColumn.value, sortDirection.value)
    return result
  })

  const totalCount = computed(() => parts.value.length)
  const filteredCount = computed(() => filteredParts.value.length)

  async function fetchParts(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      parts.value = await $fetch<EnrichedPart[]>('/api/parts')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch parts'
      parts.value = []
    } finally {
      loading.value = false
    }
  }

  function setSort(column: keyof EnrichedPart): void {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn.value = column
      sortDirection.value = 'asc'
    }
  }

  return {
    parts: readonly(parts),
    loading: readonly(loading),
    error: readonly(error),
    searchQuery,
    filters,
    sortColumn,
    sortDirection,
    filteredParts,
    totalCount,
    filteredCount,
    fetchParts,
    setSort,
  }
}
