import { ref, readonly } from 'vue'
import type { AppSettings, JiraConnectionSettings, JiraFieldMapping, PageToggles } from '~/types/domain'

const settings = ref<AppSettings | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

export function useSettings() {
  async function fetchSettings() {
    loading.value = true
    error.value = null
    try {
      settings.value = await $fetch<AppSettings>('/api/settings')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch settings'
      settings.value = null
    } finally {
      loading.value = false
    }
  }

  async function updateSettings(input: {
    jiraConnection?: Partial<JiraConnectionSettings>
    jiraFieldMappings?: JiraFieldMapping[]
    pageToggles?: Partial<PageToggles>
  }): Promise<AppSettings> {
    const result = await $fetch<AppSettings>('/api/settings', {
      method: 'PUT',
      body: input
    })
    settings.value = result
    return result
  }

  return {
    settings: readonly(settings),
    loading: readonly(loading),
    error: readonly(error),
    fetchSettings,
    updateSettings
  }
}
