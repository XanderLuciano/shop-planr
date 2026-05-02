import { ref, readonly } from 'vue'
import type { FullRouteResponse, FullRouteEntry } from '~/types/computed'

export function useFullRoute(partId: string) {
  const $api = useAuthFetch()

  const entries = ref<FullRouteEntry[]>([])
  const isCompleted = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchFullRoute(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await $api<FullRouteResponse>(`/api/parts/${encodeURIComponent(partId)}/full-route`)
      entries.value = data.entries
      isCompleted.value = data.isCompleted
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch full route')
      entries.value = []
      isCompleted.value = false
    } finally {
      loading.value = false
    }
  }

  return {
    entries: readonly(entries),
    isCompleted: readonly(isCompleted),
    loading: readonly(loading),
    error: readonly(error),
    fetchFullRoute,
  }
}
