import { ref, readonly } from 'vue'
import type { WebhookRegistration } from '~/types/domain'
import { extractApiError } from '~/utils/apiError'

const registrations = ref<WebhookRegistration[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useWebhookRegistrations() {
  const $api = useAuthFetch()

  async function fetchRegistrations(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      registrations.value = await $api<WebhookRegistration[]>('/api/webhooks/registrations')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch registrations')
    } finally {
      loading.value = false
    }
  }

  async function createRegistration(input: { name: string, url: string, eventTypes: string[] }): Promise<WebhookRegistration> {
    loading.value = true
    error.value = null
    try {
      const registration = await $api<WebhookRegistration>('/api/webhooks/registrations', {
        method: 'POST',
        body: input,
      })
      await fetchRegistrations()
      return registration
    } catch (e) {
      error.value = extractApiError(e, 'Failed to create registration')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRegistration(id: string, input: { name?: string, url?: string, eventTypes?: string[] }): Promise<WebhookRegistration> {
    loading.value = true
    error.value = null
    try {
      const updated = await $api<WebhookRegistration>(`/api/webhooks/registrations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: input,
      })
      await fetchRegistrations()
      return updated
    } catch (e) {
      error.value = extractApiError(e, 'Failed to update registration')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteRegistration(id: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/webhooks/registrations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await fetchRegistrations()
    } catch (e) {
      error.value = extractApiError(e, 'Failed to delete registration')
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    registrations: readonly(registrations),
    loading: readonly(loading),
    error: readonly(error),
    fetchRegistrations,
    createRegistration,
    updateRegistration,
    deleteRegistration,
  }
}
