import { ref, readonly } from 'vue'
import type { ProcessLibraryEntry, LocationLibraryEntry } from '~/types/domain'

const processes = ref<ProcessLibraryEntry[]>([])
const locations = ref<LocationLibraryEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useLibrary() {
  const $api = useAuthFetch()

  async function fetchProcesses(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      processes.value = await $api<ProcessLibraryEntry[]>('/api/library/processes')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch processes')
    } finally {
      loading.value = false
    }
  }

  async function fetchLocations(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      locations.value = await $api<LocationLibraryEntry[]>('/api/library/locations')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch locations')
    } finally {
      loading.value = false
    }
  }

  async function addProcess(name: string): Promise<ProcessLibraryEntry> {
    loading.value = true
    error.value = null
    try {
      const entry = await $api<ProcessLibraryEntry>('/api/library/processes', {
        method: 'POST',
        body: { name },
      })
      processes.value = [...processes.value, entry]
      return entry
    } catch (e) {
      error.value = extractApiError(e, 'Failed to add process')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function removeProcess(id: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/library/processes/${encodeURIComponent(id)}`, { method: 'DELETE' })
      processes.value = processes.value.filter(p => p.id !== id)
    } catch (e) {
      error.value = extractApiError(e, 'Failed to remove process')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addLocation(name: string): Promise<LocationLibraryEntry> {
    loading.value = true
    error.value = null
    try {
      const entry = await $api<LocationLibraryEntry>('/api/library/locations', {
        method: 'POST',
        body: { name },
      })
      locations.value = [...locations.value, entry]
      return entry
    } catch (e) {
      error.value = extractApiError(e, 'Failed to add location')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function removeLocation(id: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/library/locations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      locations.value = locations.value.filter(l => l.id !== id)
    } catch (e) {
      error.value = extractApiError(e, 'Failed to remove location')
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    processes: readonly(processes),
    locations: readonly(locations),
    loading: readonly(loading),
    error: readonly(error),
    fetchProcesses,
    fetchLocations,
    addProcess,
    removeProcess,
    addLocation,
    removeLocation,
  }
}
