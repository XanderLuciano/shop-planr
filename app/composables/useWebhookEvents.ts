import { ref, readonly } from 'vue'
import type { EventWithDeliveries } from '~/types/domain'
import { extractApiError } from '~/utils/apiError'

const events = ref<EventWithDeliveries[]>([])
const stats = ref<{ queued: number, sent: number, failed: number, cancelled: number }>({ queued: 0, sent: 0, failed: 0, cancelled: 0 })
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * Composable for managing webhook events.
 *
 * State is shared across all callers via module-level refs.
 *
 * Events are persisted server-side in SQLite. The GET /api/webhooks/events
 * endpoint returns EventWithDeliveries[] — events enriched with delivery
 * summary counts. Dispatching is handled by useWebhookDeliveries.
 */
export function useWebhookEvents() {
  const $api = useAuthFetch()

  async function fetchEvents(limit = 200) {
    loading.value = true
    error.value = null
    try {
      events.value = await $api<EventWithDeliveries[]>('/api/webhooks/events', {
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

  async function deleteEvent(id: string) {
    try {
      await $api(`/api/webhooks/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
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

  return {
    events: readonly(events),
    stats: readonly(stats),
    loading: readonly(loading),
    error: readonly(error),
    fetchEvents,
    fetchStats,
    deleteEvent,
    clearAllEvents,
  }
}
