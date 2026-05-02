import { ref, readonly } from 'vue'
import type { AppSettings, JiraConnectionSettings, JiraFieldMapping, N8nConnectionSettings, PageToggles } from '~/types/domain'

const settings = ref<AppSettings | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

export function useSettings() {
  const $api = useAuthFetch()

  async function fetchSettings() {
    loading.value = true
    error.value = null
    try {
      settings.value = await $api<AppSettings>('/api/settings')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch settings')
      settings.value = null
    } finally {
      loading.value = false
    }
  }

  async function updateSettings(input: {
    jiraConnection?: Partial<JiraConnectionSettings>
    jiraFieldMappings?: JiraFieldMapping[]
    pageToggles?: Partial<PageToggles>
    n8nConnection?: Partial<N8nConnectionSettings>
  }): Promise<AppSettings> {
    const result = await $api<AppSettings>('/api/settings', {
      method: 'PUT',
      body: input,
    })
    settings.value = result
    return result
  }

  /**
   * Test an n8n connection without persisting. If `connection` is omitted,
   * tests the saved/env connection. Admin-only server-side.
   */
  async function testN8nConnection(
    connection?: { baseUrl?: string, apiKey?: string },
  ): Promise<{ connected: boolean, baseUrl: string, error?: string }> {
    return await $api<{ connected: boolean, baseUrl: string, error?: string }>(
      '/api/n8n/test-connection',
      {
        method: 'POST',
        body: connection ?? {},
      },
    )
  }

  return {
    settings: readonly(settings),
    loading: readonly(loading),
    error: readonly(error),
    fetchSettings,
    updateSettings,
    testN8nConnection,
  }
}
