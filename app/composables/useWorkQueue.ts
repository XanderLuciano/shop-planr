import { ref, computed, readonly } from 'vue'
import type { WorkQueueJob, WorkQueueResponse } from '~/types/computed'

const queue = ref<WorkQueueResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')

export function useWorkQueue() {
  const $api = useAuthFetch()

  const filteredJobs = computed<WorkQueueJob[]>(() => {
    const jobs = queue.value?.jobs ?? []
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(job =>
      job.jobName.toLowerCase().includes(q)
      || job.pathName.toLowerCase().includes(q)
      || job.stepName.toLowerCase().includes(q),
    )
  })

  const totalParts = computed<number>(() => queue.value?.totalParts ?? 0)

  const filteredParts = computed<number>(() =>
    filteredJobs.value.reduce((sum, j) => sum + j.partCount, 0),
  )

  async function fetchQueue(userId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      queue.value = await $api<WorkQueueResponse>(`/api/operator/queue/${encodeURIComponent(userId)}`)
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch work queue'
      queue.value = null
    } finally {
      loading.value = false
    }
  }

  async function advanceBatch(params: {
    partIds: string[]
    jobId: string
    pathId: string
    stepId: string
    note?: string
  }): Promise<{ advanced: number, nextStepName?: string }> {
    const { partIds, jobId, pathId, stepId, note } = params

    // Validate quantity against available parts
    const job = queue.value?.jobs.find(
      j => j.jobId === jobId && j.pathId === pathId && j.stepId === stepId,
    )
    if (job && partIds.length > job.partCount) {
      throw new Error(`Cannot advance ${partIds.length} parts — only ${job.partCount} available`)
    }

    for (const partId of partIds) {
      await $api(`/api/parts/${encodeURIComponent(partId)}/advance`, {
        method: 'POST',
      })
    }

    // Create note if provided and non-empty
    const trimmedNote = note?.trim()
    if (trimmedNote && trimmedNote.length > 0) {
      if (trimmedNote.length > 1000) {
        throw new Error('Note must be 1000 characters or fewer')
      }
      await $api('/api/notes', {
        method: 'POST',
        body: {
          jobId,
          pathId,
          stepId,
          partIds,
          text: trimmedNote,
        },
      })
    }

    return {
      advanced: partIds.length,
      nextStepName: job?.isFinalStep ? undefined : job?.nextStepName,
    }
  }

  return {
    queue: readonly(queue),
    loading: readonly(loading),
    error: readonly(error),
    searchQuery,
    filteredJobs,
    totalParts,
    filteredParts,
    fetchQueue,
    advanceBatch,
  }
}
