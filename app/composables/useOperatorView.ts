import { ref, readonly } from 'vue'
import type { OperatorStepView } from '~/types/computed'

const data = ref<OperatorStepView | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

export function useOperatorView() {
  const $api = useAuthFetch()

  async function fetchOperatorView(stepName: string) {
    loading.value = true
    error.value = null
    data.value = null
    try {
      data.value = await $api<OperatorStepView>(`/api/operator/${encodeURIComponent(stepName)}`)
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch operator view')
    } finally {
      loading.value = false
    }
  }

  function clear() {
    data.value = null
    error.value = null
  }

  return {
    data: readonly(data),
    loading: readonly(loading),
    error: readonly(error),
    fetchOperatorView,
    clear,
  }
}
