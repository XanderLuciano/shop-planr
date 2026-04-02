import { ref, computed, readonly } from 'vue'
import type { WorkQueueGroup, WorkQueueGroupedResponse } from '~/types/computed'

const response = ref<WorkQueueGroupedResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')

export function useOperatorWorkQueue() {
  const groups = computed<WorkQueueGroup[]>(() => response.value?.groups ?? [])

  const totalParts = computed<number>(() => response.value?.totalParts ?? 0)

  const filteredGroups = computed<WorkQueueGroup[]>(() => {
    const all = groups.value
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return all

    return all
      .map((group) => {
        const matchesLabel = group.groupLabel.toLowerCase().includes(q)
        const matchingJobs = group.jobs.filter(job =>
          job.jobName.toLowerCase().includes(q)
          || job.pathName.toLowerCase().includes(q)
          || job.stepName.toLowerCase().includes(q)
          || matchesLabel,
        )
        if (matchingJobs.length === 0) return null
        return {
          ...group,
          jobs: matchingJobs,
          totalParts: matchingJobs.reduce((sum, j) => sum + j.partCount, 0),
        }
      })
      .filter((g): g is WorkQueueGroup => g !== null)
  })

  async function fetchGroupedWork(params?: { groupBy?: string }): Promise<void> {
    loading.value = true
    error.value = null
    try {
      response.value = await $fetch<WorkQueueGroupedResponse>('/api/operator/work-queue', {
        query: params?.groupBy ? { groupBy: params.groupBy } : undefined,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch work queue'
      response.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    response: readonly(response),
    groups,
    loading: readonly(loading),
    error: readonly(error),
    searchQuery,
    filteredGroups,
    totalParts,
    fetchGroupedWork,
  }
}
