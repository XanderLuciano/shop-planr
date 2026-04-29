import type { WebhookEventType } from '../types/domain'

/**
 * Queue a webhook event server-side. Fire-and-forget — errors are
 * silently swallowed so event emission never disrupts the primary
 * API response.
 *
 * This replaces the old client-side useWebhookEmit composable.
 * Events are now recorded at the API boundary so every client
 * (any browser, any user) generates events. The webhooks page
 * dispatch loop picks them up and fires the HTTP POSTs.
 */
export function emitWebhookEvent(
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  summary?: string,
): void {
  try {
    const autoSummary = summary ?? buildSummary(eventType, payload)
    getServices().webhookService.queueEvent({
      eventType,
      payload,
      summary: autoSummary,
    })
  } catch {
    // Silently swallow — webhook emission should never break the API
  }
}

/**
 * Resolve a userId to a display name for webhook payloads.
 * Returns 'system' if the user can't be found.
 */
export function resolveUserName(userId: string): string {
  try {
    const user = getRepositories().users.getById(userId)
    return user?.displayName ?? user?.username ?? 'system'
  } catch {
    return 'system'
  }
}

/**
 * Format a webhook event type for display.
 * Single source of truth — used by both server-side summary generation
 * and the client-side UI (re-exported from app/utils/webhookFormatting.ts).
 *
 * "part_advanced" → "Part Advanced"
 */
export function formatWebhookEventType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function buildSummary(eventType: WebhookEventType, data: Record<string, unknown>): string {
  const parts: string[] = [formatWebhookEventType(eventType)]

  if (data.user) parts.push(String(data.user))

  if (data.partIds) {
    const ids = data.partIds as string[]
    const count = (data.count ?? data.advancedCount ?? ids.length) as number
    if (ids.length <= 3) {
      parts.push(ids.join(', '))
    } else {
      parts.push(`${ids.slice(0, 3).join(', ')} (+${count - 3} more)`)
    }
  } else if (data.partId) {
    parts.push(String(data.partId))
  }

  if (data.fromStep && data.toStep) {
    parts.push(`${data.fromStep} → ${data.toStep}`)
  } else if (data.stepName) {
    parts.push(String(data.stepName))
  }

  if (data.jobName) parts.push(String(data.jobName))

  return parts.join(' | ')
}
