import type { WebhookEventType } from '~/types/domain'

/**
 * Lightweight composable for emitting webhook events from anywhere in the app.
 *
 * Usage:
 *   const { emit } = useWebhookEmit()
 *   emit('part_advanced', { user: 'admin', partId: 'SN-00042', fromStep: 'Step 3', toStep: 'Step 4' })
 *
 * Events are queued server-side. The webhooks admin page dispatches them.
 */
export function useWebhookEmit() {
  const $api = useAuthFetch()

  /**
   * Queue a webhook event. Fire-and-forget — errors are silently swallowed
   * so event emission never disrupts the primary user flow.
   */
  function emit(
    eventType: WebhookEventType,
    data: Record<string, unknown>,
    summary?: string,
  ) {
    const autoSummary = summary ?? buildSummary(eventType, data)

    // Fire and forget — don't await, don't block the caller
    $api('/api/webhooks/events', {
      method: 'POST',
      body: {
        eventType,
        payload: data,
        summary: autoSummary,
      },
    }).catch(() => {
      // Silently swallow — webhook emission should never break the app
    })
  }

  return { emit }
}

/**
 * Build a human-readable one-liner from event type + payload.
 * e.g. "PartAdvanced | admin | SN-00042 | Step 3 → Step 4"
 */
function buildSummary(eventType: WebhookEventType, data: Record<string, unknown>): string {
  const parts: string[] = [formatEventType(eventType)]

  if (data.user || data.username || data.displayName) {
    parts.push(String(data.user ?? data.username ?? data.displayName))
  }

  if (data.partId || data.partIds) {
    const ids = data.partIds
      ? (data.partIds as string[]).slice(0, 3).join(', ')
      : String(data.partId)
    parts.push(ids)
  }

  if (data.fromStep && data.toStep) {
    parts.push(`${data.fromStep} → ${data.toStep}`)
  } else if (data.stepName) {
    parts.push(String(data.stepName))
  }

  if (data.jobName) {
    parts.push(String(data.jobName))
  }

  return parts.join(' | ')
}

function formatEventType(type: WebhookEventType): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}
