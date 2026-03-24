import { ref, computed, readonly } from 'vue'
import type { OperatorGroup, WorkQueueGroupedResponse } from '~/server/types/computed'

const response = ref<WorkQueueGroupedResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')

export function useOperatorWorkQueue() {
  const groups = computed<OperatorGroup[]>(() => response.value?.groups ?? [])

  const totalParts = computed<number>(() => response.value?.totalParts ?? 0)

  const filteredGroups = computed<OperatorGroup[]>(() => {
    const all = groups.value
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return all

    return all
      .map((group) => {
        const matchesOperator = group.operatorName.toLowerCase().includes(q)
        const matchingJobs = group.jobs.filter(job =>
          job.jobName.toLowerCase().includes(q)
          || job.pathName.toLowerCase().includes(q)
          || job.stepName.toLowerCase().includes(q)
          || matchesOperator,
        )
        if (matchingJobs.length === 0) return null
        return {
          ...group,
          jobs: matchingJobs,
          totalParts: matchingJobs.reduce((sum, j) => sum + j.partCount, 0),
        }
      })
      .filter((g): g is OperatorGroup => g !== null)
  })

  async function fetchGroupedWork(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      response.value = await $fetch<WorkQueueGroupedResponse>('/api/operator/work-queue')
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
