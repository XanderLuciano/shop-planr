import type { WebhookEvent, WebhookConfig, WebhookEventType } from '~/types/domain'

/**
 * Composable for managing webhook events.
 *
 * State is shared across all callers via useState — the dispatch plugin
 * and the webhooks admin page see the same config/events/stats.
 *
 * Events are persisted server-side in SQLite so they survive across sessions.
 * Dispatching happens client-side — the browser sends events to the configured
 * endpoint URL. This allows the client to reach servers that the backend can't.
 */
export function useWebhookEvents() {
  const $api = useAuthFetch()

  // Shared state — all callers (plugin + page) see the same refs
  const config = useState<WebhookConfig | null>('webhook:config', () => null)
  const events = useState<WebhookEvent[]>('webhook:events', () => [])
  const stats = useState<{ queued: number, sent: number, failed: number, cancelled: number }>('webhook:stats', () => ({ queued: 0, sent: 0, failed: 0, cancelled: 0 }))
  const loading = useState<boolean>('webhook:loading', () => false)
  const dispatching = useState<boolean>('webhook:dispatching', () => false)
  const error = useState<string | null>('webhook:error', () => null)

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
      stats.value = await $api<{ queued: number, sent: number, failed: number, cancelled: number }>('/api/webhooks/events/stats')
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
   *
   * Only dispatches events whose type is enabled AND whose createdAt
   * is >= the enabledSince timestamp for that type (prevents retroactive
   * dispatch when a new category is toggled on).
   */
  async function dispatchQueued() {
    if (!config.value?.endpointUrl || !config.value.isActive) return
    if (dispatching.value) return

    dispatching.value = true
    error.value = null

    try {
      const queued = await $api<WebhookEvent[]>('/api/webhooks/events/queued')
      if (!queued.length) return

      // Filter to only enabled event types, and only events created after the type was enabled
      const enabled = new Set(config.value.enabledEventTypes)
      const since = config.value.enabledSince ?? {}
      const toSend = queued.filter((e) => {
        if (!enabled.has(e.eventType)) return false
        const enabledAt = since[e.eventType]
        // If no enabledSince timestamp, allow (backwards compat for types enabled before this feature)
        if (!enabledAt) return true
        return e.createdAt >= enabledAt
      })

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

  /**
   * Manually dispatch a single event to the configured endpoint,
   * regardless of enabledSince or enabled types. For admin use
   * when reviewing the queue and firing past events.
   */
  async function dispatchSingle(evt: WebhookEvent) {
    if (!config.value?.endpointUrl) {
      error.value = 'No endpoint URL configured'
      return
    }

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

      const status: 'sent' | 'failed' = response.ok ? 'sent' : 'failed'
      const errMsg = response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`

      await $api('/api/webhooks/events/batch-status', {
        method: 'POST',
        body: { events: [{ id: evt.id, status, error: errMsg }] },
      })

      await fetchEvents()
      await fetchStats()
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Failed to dispatch event')
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
    dispatchSingle,
  }
}
