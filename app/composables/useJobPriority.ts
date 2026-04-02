import { ref, readonly } from 'vue'
import type { Job } from '~/types/domain'

const isEditingPriority = ref(false)
const orderedJobs = ref<Job[]>([])
const saving = ref(false)
const snapshot = ref<Job[]>([])

export function useJobPriority() {
  function enterEditMode(jobs: Job[]) {
    snapshot.value = [...jobs]
    orderedJobs.value = [...jobs]
    isEditingPriority.value = true
  }

  function cancelEdit() {
    orderedJobs.value = [...snapshot.value]
    isEditingPriority.value = false
  }

  function reorder(fromIndex: number, toIndex: number) {
    const list = orderedJobs.value
    const item = list.splice(fromIndex, 1)[0]
    if (item) {
      list.splice(toIndex, 0, item)
    }
  }

  async function savePriorities(refresh?: () => Promise<void>) {
    saving.value = true
    try {
      const priorities = orderedJobs.value.map((job, index) => ({
        jobId: job.id,
        priority: index + 1
      }))
      await $fetch('/api/jobs/priorities', {
        method: 'PATCH',
        body: { priorities }
      })
      isEditingPriority.value = false
      if (refresh) {
        await refresh()
      }
    } finally {
      saving.value = false
    }
  }

  return {
    isEditingPriority: readonly(isEditingPriority),
    orderedJobs: readonly(orderedJobs),
    saving: readonly(saving),
    enterEditMode,
    cancelEdit,
    reorder,
    savePriorities
  }
}
