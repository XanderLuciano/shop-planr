import { ref, readonly } from 'vue'
import type { WorkQueueJob, StepViewResponse } from '~/types/computed'
import type { StepNote } from '~/types/domain'

export function useStepView(stepId: string) {
  const $api = useAuthFetch()

  const job = ref<WorkQueueJob | null>(null)
  const notes = ref<StepNote[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  const previousStepWipCount = ref<number | undefined>(undefined)

  async function fetchStep(): Promise<void> {
    loading.value = true
    error.value = null
    notFound.value = false
    try {
      const data = await $api<StepViewResponse>(`/api/operator/step/${stepId}`)
      job.value = data.job
      notes.value = data.notes
      previousStepWipCount.value = data.previousStepWipCount
    } catch (e) {
      if (e?.response?.status === 404 || e?.status === 404 || e?.statusCode === 404) {
        notFound.value = true
        error.value = e?.data?.message ?? 'Step not found'
      } else {
        error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch step data'
      }
      job.value = null
      notes.value = []
      previousStepWipCount.value = undefined
    } finally {
      loading.value = false
    }
  }

  return {
    job: readonly(job),
    notes: readonly(notes),
    loading: readonly(loading),
    error: readonly(error),
    notFound: readonly(notFound),
    previousStepWipCount: readonly(previousStepWipCount),
    fetchStep,
  }
}
