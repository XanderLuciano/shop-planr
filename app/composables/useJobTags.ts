import { ref, readonly } from 'vue'
import type { Tag } from '~/types/domain'

const jobTags = ref<Tag[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useJobTags() {
  const $api = useAuthFetch()

  async function fetchJobTags(jobId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      jobTags.value = await $api<Tag[]>(`/api/jobs/${encodeURIComponent(jobId)}/tags`)
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch job tags'
    } finally {
      loading.value = false
    }
  }

  async function setJobTags(jobId: string, tagIds: string[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      jobTags.value = await $api<Tag[]>(`/api/jobs/${encodeURIComponent(jobId)}/tags`, {
        method: 'PUT',
        body: { tagIds },
      })
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to set job tags'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    tags: readonly(jobTags),
    loading: readonly(loading),
    error: readonly(error),
    fetchJobTags,
    setJobTags,
  }
}
