import { ref, computed, readonly } from 'vue'
import type { WorkQueueJob, WorkQueueResponse } from '~/types/computed'

const response = ref<WorkQueueResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')

export function usePartsView() {
  const jobs = computed<WorkQueueJob[]>(() => response.value?.jobs ?? [])

  const filteredJobs = computed<WorkQueueJob[]>(() => {
    const all = jobs.value
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return all
    return all.filter(job =>
      job.jobName.toLowerCase().includes(q)
      || job.pathName.toLowerCase().includes(q)
      || job.stepName.toLowerCase().includes(q),
    )
  })

  const totalParts = computed<number>(() =>
    jobs.value.reduce((sum, j) => sum + j.partCount, 0),
  )

  const filteredParts = computed<number>(() =>
    filteredJobs.value.reduce((sum, j) => sum + j.partCount, 0),
  )

  async function fetchAllWork(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      response.value = await $fetch<WorkQueueResponse>('/api/operator/queue/_all')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch active work'
      response.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    jobs,
    loading: readonly(loading),
    error: readonly(error),
    searchQuery,
    filteredJobs,
    totalParts,
    filteredParts,
    fetchAllWork,
  }
}
