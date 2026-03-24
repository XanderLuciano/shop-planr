import { ref, readonly } from 'vue'
import type { OperatorStepView } from '~/server/types/computed'

const data = ref<OperatorStepView | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

export function useOperatorView() {
  async function fetchOperatorView(stepName: string) {
    loading.value = true
    error.value = null
    data.value = null
    try {
      data.value = await $fetch<OperatorStepView>(`/api/operator/${encodeURIComponent(stepName)}`)
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch operator view'
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
    clear
  }
}
