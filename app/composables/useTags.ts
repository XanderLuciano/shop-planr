import { ref, readonly } from 'vue'
import type { Tag } from '~/types/domain'
import { extractApiError } from '~/utils/apiError'

const tags = ref<Tag[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useTags() {
  const $api = useAuthFetch()

  async function fetchTags(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      tags.value = await $api<Tag[]>('/api/tags')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch tags')
    } finally {
      loading.value = false
    }
  }

  async function createTag(name: string, color?: string): Promise<Tag> {
    loading.value = true
    error.value = null
    try {
      const tag = await $api<Tag>('/api/tags', {
        method: 'POST',
        body: { name, color },
      })
      tags.value = [...tags.value, tag]
      return tag
    } catch (e) {
      error.value = extractApiError(e, 'Failed to create tag')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateTag(id: string, input: { name?: string, color?: string }): Promise<Tag> {
    loading.value = true
    error.value = null
    try {
      const updated = await $api<Tag>(`/api/tags/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: input,
      })
      tags.value = tags.value.map(t => (t.id === id ? updated : t))
      return updated
    } catch (e) {
      error.value = extractApiError(e, 'Failed to update tag')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteTag(id: string, options: { force?: boolean } = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const query = options.force ? '?force=true' : ''
      await $api(`/api/tags/${encodeURIComponent(id)}${query}`, { method: 'DELETE' })
      tags.value = tags.value.filter(t => t.id !== id)
    } catch (e) {
      error.value = extractApiError(e, 'Failed to delete tag')
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    tags: readonly(tags),
    loading: readonly(loading),
    error: readonly(error),
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  }
}
