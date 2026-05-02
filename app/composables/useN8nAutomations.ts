import type { N8nAutomation, N8nWorkflowDefinition, WebhookEventType } from '~/types/domain'

export function useN8nAutomations() {
  const $api = useAuthFetch()

  const automations = ref<N8nAutomation[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const n8nStatus = ref<{ connected: boolean, baseUrl: string, error?: string } | null>(null)

  async function fetchAutomations() {
    loading.value = true
    error.value = null
    try {
      automations.value = await $api<N8nAutomation[]>('/api/n8n/automations')
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to load automations')
    } finally {
      loading.value = false
    }
  }

  async function fetchN8nStatus() {
    try {
      n8nStatus.value = await $api<{ connected: boolean, baseUrl: string, error?: string }>('/api/n8n/status')
    } catch {
      n8nStatus.value = { connected: false, baseUrl: '', error: 'Failed to check n8n status' }
    }
  }

  async function createAutomation(input: {
    name: string
    description?: string
    eventTypes: WebhookEventType[]
    workflowJson: N8nWorkflowDefinition
    enabled?: boolean
  }): Promise<N8nAutomation> {
    const result = await $api<N8nAutomation>('/api/n8n/automations', {
      method: 'POST',
      body: input,
    })
    await fetchAutomations()
    return result
  }

  async function updateAutomation(id: string, updates: {
    name?: string
    description?: string
    eventTypes?: WebhookEventType[]
    workflowJson?: N8nWorkflowDefinition
    enabled?: boolean
  }): Promise<N8nAutomation> {
    const result = await $api<N8nAutomation>(`/api/n8n/automations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: updates,
    })
    await fetchAutomations()
    return result
  }

  async function deleteAutomation(id: string): Promise<void> {
    await $api(`/api/n8n/automations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    await fetchAutomations()
  }

  async function deployAutomation(id: string): Promise<N8nAutomation> {
    const result = await $api<N8nAutomation>(`/api/n8n/automations/${encodeURIComponent(id)}/deploy`, {
      method: 'POST',
    })
    await fetchAutomations()
    return result
  }

  return {
    automations,
    loading,
    error,
    n8nStatus,
    fetchAutomations,
    fetchN8nStatus,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    deployAutomation,
  }
}
