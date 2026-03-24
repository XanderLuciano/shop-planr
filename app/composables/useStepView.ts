import { ref, readonly } from 'vue'
import type { WorkQueueJob, StepViewResponse } from '~/server/types/computed'
import type { StepNote } from '~/server/types/domain'

export function useStepView(stepId: string) {
  const job = ref<WorkQueueJob | null>(null)
  const notes = ref<StepNote[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)

  async function fetchStep(): Promise<void> {
    loading.value = true
    error.value = null
    notFound.value = false
    try {
      const data = await $fetch<StepViewResponse>(`/api/operator/step/${stepId}`)
      job.value = data.job
      notes.value = data.notes
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.status === 404 || e?.statusCode === 404) {
        notFound.value = true
        error.value = e?.data?.message ?? 'Step not found'
      } else {
        error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch step data'
      }
      job.value = null
      notes.value = []
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
    fetchStep,
  }
}
