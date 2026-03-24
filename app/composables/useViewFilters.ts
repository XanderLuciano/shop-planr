import { ref, watch } from 'vue'
import type { FilterState } from '~/server/types/domain'

const STORAGE_KEY = 'shop_erp_view_filters'

const filters = ref<FilterState>(loadFromStorage())

function loadFromStorage(): FilterState {
  if (import.meta.server) return { status: 'all' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt data
  }
  return { status: 'all' }
}

function saveToStorage(state: FilterState) {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

// Persist on every change
watch(filters, val => saveToStorage(val), { deep: true })

export function useViewFilters() {
  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    filters.value = { ...filters.value, [key]: value }
  }

  function clearFilters() {
    filters.value = { status: 'all' }
  }

  /**
   * Generic client-side filter function.
   * Accepts items and an accessor map that extracts filterable fields from each item.
   */
  function applyFilters<T>(
    items: T[],
    accessors: {
      jobName?: (item: T) => string | undefined
      jiraTicketKey?: (item: T) => string | undefined
      stepName?: (item: T) => string | undefined
      assignee?: (item: T) => string | undefined
      priority?: (item: T) => string | undefined
      label?: (item: T) => string | undefined
      status?: (item: T) => 'active' | 'completed' | undefined
    }
  ): T[] {
    const f = filters.value
    return items.filter((item) => {
      if (f.jobName && accessors.jobName) {
        const val = accessors.jobName(item) ?? ''
        if (!val.toLowerCase().includes(f.jobName.toLowerCase())) return false
      }
      if (f.jiraTicketKey && accessors.jiraTicketKey) {
        const val = accessors.jiraTicketKey(item) ?? ''
        if (!val.toLowerCase().includes(f.jiraTicketKey.toLowerCase())) return false
      }
      if (f.stepName && accessors.stepName) {
        const val = accessors.stepName(item) ?? ''
        if (!val.toLowerCase().includes(f.stepName.toLowerCase())) return false
      }
      if (f.assignee && accessors.assignee) {
        const val = accessors.assignee(item) ?? ''
        if (!val.toLowerCase().includes(f.assignee.toLowerCase())) return false
      }
      if (f.priority && accessors.priority) {
        const val = accessors.priority(item) ?? ''
        if (!val.toLowerCase().includes(f.priority.toLowerCase())) return false
      }
      if (f.label && accessors.label) {
        const val = accessors.label(item) ?? ''
        if (!val.toLowerCase().includes(f.label.toLowerCase())) return false
      }
      if (f.status && f.status !== 'all' && accessors.status) {
        const val = accessors.status(item)
        if (val && val !== f.status) return false
      }
      return true
    })
  }

  return {
    filters,
    updateFilter,
    clearFilters,
    applyFilters
  }
}
