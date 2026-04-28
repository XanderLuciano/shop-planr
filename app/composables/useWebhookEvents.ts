import type { WebhookEvent, WebhookConfig, WebhookEventType } from '~/types/domain'

/**
 * Composable for managing webhook events.
 *
 * Events are persisted server-side in SQLite so they survive across sessions.
 * Dispatching happens client-side — the browser sends events to the configured
 * endpoint URL. This allows the client to reach servers that the backend can't.
 */
export function useWebhookEvents() {
  const $api = useAuthFetch()

  const config = ref<WebhookConfig | null>(null)
  const events = ref<WebhookEvent[]>([])
  const stats = ref<{ queued: number, sent: number, failed: number }>({ queued: 0, sent: 0, failed: 0 })
  const loading = ref(false)
  const dispatching = ref(false)
  const error = ref<string | null>(null)

  async function fetchConfig() {
    try {
      config.value = await $api<WebhookConfig>('/api/webhooks/config')
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to load webhook config')
    }
  }

  async function updateConfig(input: {
    endpointUrl?: string
    enabledEventTypes?: WebhookEventType[]
    isActive?: boolean
  }) {
    try {
      config.value = await $api<WebhookConfig>('/api/webhooks/config', {
        method: 'PATCH',
        body: input,
      })
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to update webhook config')
    }
  }

  async function fetchEvents(limit = 200) {
    loading.value = true
    try {
      events.value = await $api<WebhookEvent[]>('/api/webhooks/events', {
        params: { limit },
      })
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to load events')
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    try {
      stats.value = await $api<{ queued: number, sent: number, failed: number }>('/api/webhooks/events/stats')
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to load stats')
    }
  }

  async function retryAllFailed() {
    try {
      await $api('/api/webhooks/events/retry-all', { method: 'POST' })
      await fetchEvents()
      await fetchStats()
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to retry events')
    }
  }

  async function deleteEvent(id: string) {
    try {
      await $api(`/api/webhooks/events/${id}`, { method: 'DELETE' })
      events.value = events.value.filter(e => e.id !== id)
      await fetchStats()
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to delete event')
    }
  }

  async function clearAllEvents() {
    try {
      await $api('/api/webhooks/events', { method: 'DELETE' })
      events.value = []
      await fetchStats()
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to clear events')
    }
  }

  /**
   * Dispatch all queued events to the configured endpoint.
   * Runs client-side — the browser makes the HTTP calls.
   */
  async function dispatchQueued() {
    if (!config.value?.endpointUrl || !config.value.isActive) return
    if (dispatching.value) return

    dispatching.value = true
    error.value = null

    try {
      const queued = await $api<WebhookEvent[]>('/api/webhooks/events/queued')
      if (!queued.length) return

      // Filter to only enabled event types
      const enabled = new Set(config.value.enabledEventTypes)
      const toSend = queued.filter(e => enabled.has(e.eventType))

      const results: { id: string, status: 'sent' | 'failed', error?: string }[] = []

      for (const evt of toSend) {
        try {
          const response = await fetch(config.value.endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: evt.eventType,
              summary: evt.summary,
              timestamp: evt.createdAt,
              ...evt.payload,
            }),
          })

          if (response.ok) {
            results.push({ id: evt.id, status: 'sent' })
          } else {
            results.push({ id: evt.id, status: 'failed', error: `HTTP ${response.status}: ${response.statusText}` })
          }
        } catch (fetchErr: unknown) {
          const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error'
          results.push({ id: evt.id, status: 'failed', error: msg })
        }
      }

      // Batch update statuses on the server
      if (results.length) {
        await $api('/api/webhooks/events/batch-status', {
          method: 'POST',
          body: { events: results },
        })
      }

      await fetchEvents()
      await fetchStats()
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to dispatch events')
    } finally {
      dispatching.value = false
    }
  }

  return {
    config,
    events,
    stats,
    loading,
    dispatching,
    error,
    fetchConfig,
    updateConfig,
    fetchEvents,
    fetchStats,
    retryAllFailed,
    deleteEvent,
    clearAllEvents,
    dispatchQueued,
  }
}
