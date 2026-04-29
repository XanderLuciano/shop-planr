import { ref, readonly } from 'vue'
import type { QueuedDeliveryView, WebhookDeliveryStatus, WebhookDelivery } from '~/types/domain'
import { extractApiError } from '~/utils/apiError'

const dispatching = ref(false)
const error = ref<string | null>(null)

/**
 * Composable for webhook delivery dispatch and status management.
 *
 * The dispatch engine runs client-side — the browser sends HTTP POST
 * requests to registration URLs (LAN endpoints the server can't reach).
 * After dispatching, statuses are reported back to the server via the
 * batch-status endpoint.
 *
 * Deliveries are processed sequentially per registration URL to avoid
 * overwhelming a single endpoint.
 */
export function useWebhookDeliveries() {
  const $api = useAuthFetch()

  /** Fetch all queued deliveries with registration URLs for dispatch. */
  async function fetchQueuedDeliveries(): Promise<QueuedDeliveryView[]> {
    try {
      return await $api<QueuedDeliveryView[]>('/api/webhooks/deliveries/queued')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch queued deliveries')
      return []
    }
  }

  /**
   * Build the dispatch payload from a queued delivery view.
   * Format: { event, summary, timestamp, ...payload }
   */
  function buildPayload(delivery: QueuedDeliveryView): Record<string, unknown> {
    return {
      event: delivery.eventType,
      summary: delivery.summary,
      timestamp: delivery.eventCreatedAt,
      ...delivery.payload,
    }
  }

  /**
   * Send a single delivery to its registration URL and return the status result.
   * Uses plain $fetch (not authenticated) since these are LAN endpoints.
   */
  async function sendToEndpoint(delivery: QueuedDeliveryView): Promise<{ id: string, status: WebhookDeliveryStatus, error?: string }> {
    try {
      const response = await fetch(delivery.registrationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(delivery)),
      })

      if (response.ok) {
        return { id: delivery.id, status: 'delivered' }
      } else {
        return { id: delivery.id, status: 'failed', error: `HTTP ${response.status}: ${response.statusText}` }
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error'
      return { id: delivery.id, status: 'failed', error: msg }
    }
  }

  /**
   * Dispatch all queued deliveries.
   *
   * Groups deliveries by registration URL and processes them sequentially
   * per URL to avoid overwhelming endpoints. After all dispatches complete,
   * reports statuses back to the server in a single batch call.
   */
  async function dispatchQueued(): Promise<void> {
    if (dispatching.value) return

    dispatching.value = true
    error.value = null

    try {
      const queued = await fetchQueuedDeliveries()
      if (!queued.length) return

      // Mark all as 'delivering' before starting
      const deliveringUpdates = queued.map(d => ({ id: d.id, status: 'delivering' as WebhookDeliveryStatus }))
      await $api('/api/webhooks/deliveries/batch-status', {
        method: 'POST',
        body: { deliveries: deliveringUpdates },
      })

      // Group deliveries by registration URL for sequential processing per URL
      const byUrl = new Map<string, QueuedDeliveryView[]>()
      for (const delivery of queued) {
        const group = byUrl.get(delivery.registrationUrl) || []
        group.push(delivery)
        byUrl.set(delivery.registrationUrl, group)
      }

      // Process each URL group sequentially, but URL groups in parallel
      const results: { id: string, status: WebhookDeliveryStatus, error?: string }[] = []

      const urlGroups = Array.from(byUrl.values())
      await Promise.all(urlGroups.map(async (deliveries) => {
        for (const delivery of deliveries) {
          const result = await sendToEndpoint(delivery)
          results.push(result)
        }
      }))

      // Batch report final statuses back to the server
      if (results.length) {
        await $api('/api/webhooks/deliveries/batch-status', {
          method: 'POST',
          body: { deliveries: results },
        })
      }
    } catch (e) {
      error.value = extractApiError(e, 'Failed to dispatch deliveries')
    } finally {
      dispatching.value = false
    }
  }

  /**
   * Dispatch a single delivery immediately to its registration URL.
   * Marks it as delivering, sends the POST, then reports the final status.
   */
  async function dispatchSingle(delivery: QueuedDeliveryView): Promise<void> {
    error.value = null

    try {
      // Mark as delivering
      await $api(`/api/webhooks/deliveries/${encodeURIComponent(delivery.id)}`, {
        method: 'PATCH',
        body: { status: 'delivering' },
      })

      // Send to endpoint
      const result = await sendToEndpoint(delivery)

      // Report final status
      await $api(`/api/webhooks/deliveries/${encodeURIComponent(delivery.id)}`, {
        method: 'PATCH',
        body: { status: result.status, error: result.error },
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to dispatch delivery')
    }
  }

  /** Update a single delivery's status (e.g. retry, cancel). */
  async function updateDeliveryStatus(id: string, status: WebhookDeliveryStatus, deliveryError?: string): Promise<WebhookDelivery | undefined> {
    error.value = null
    try {
      return await $api<WebhookDelivery>(`/api/webhooks/deliveries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { status, error: deliveryError },
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to update delivery status')
      return undefined
    }
  }

  /** Replay an event — creates new delivery records for all matching registrations. */
  async function replayEvent(eventId: string): Promise<WebhookDelivery[]> {
    error.value = null
    try {
      return await $api<WebhookDelivery[]>(`/api/webhooks/events/${encodeURIComponent(eventId)}/replay`, {
        method: 'POST',
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to replay event')
      return []
    }
  }

  /** Retry failed deliveries for an event — transitions failed → queued. */
  async function retryFailed(eventId: string): Promise<WebhookDelivery[]> {
    error.value = null
    try {
      return await $api<WebhookDelivery[]>(`/api/webhooks/events/${encodeURIComponent(eventId)}/retry-failed`, {
        method: 'POST',
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to retry failed deliveries')
      return []
    }
  }

  /** Cancel a queued delivery (queued → canceled). */
  async function cancelDelivery(id: string): Promise<WebhookDelivery | undefined> {
    return updateDeliveryStatus(id, 'canceled')
  }

  return {
    dispatching: readonly(dispatching),
    error: readonly(error),
    fetchQueuedDeliveries,
    dispatchQueued,
    dispatchSingle,
    updateDeliveryStatus,
    replayEvent,
    retryFailed,
    cancelDelivery,
  }
}
