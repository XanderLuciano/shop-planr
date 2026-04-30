import type { WebhookEventType } from '../types/domain'
import type { WebhookPayloadMap } from '../schemas/webhookPayloadSchemas'
import { WEBHOOK_PAYLOAD_SCHEMAS } from '../schemas/webhookPayloadSchemas'

/**
 * Queue a webhook event server-side. Fire-and-forget — errors are
 * silently swallowed so event emission never disrupts the primary
 * API response.
 *
 * The generic parameter links the event type to its payload schema,
 * so every call site gets compile-time type checking. Payloads are
 * also validated at runtime in dev mode as a safety net.
 */
export function emitWebhookEvent<T extends WebhookEventType>(
  eventType: T,
  payload: WebhookPayloadMap[T],
  summary?: string,
): void {
  try {
    // Dev-time validation: warn if payload doesn't match the schema
    if (import.meta.dev) {
      const schema = WEBHOOK_PAYLOAD_SCHEMAS[eventType]
      if (schema) {
        const result = schema.safeParse(payload)
        if (!result.success) {
          console.warn(`[webhook] payload validation warning for ${eventType}:`, result.error.flatten().fieldErrors)
        }
      }
    }

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
 * Resolve a stepId to its human-readable name via the part's path.
 * Returns undefined if the lookup fails (caller can omit the field).
 */
export function resolveStepName(partId: string, stepId: string): string | undefined {
  try {
    const part = getRepositories().parts.getById(partId)
    if (!part) return undefined
    const path = getRepositories().paths.getById(part.pathId)
    if (!path) return undefined
    return path.steps.find(s => s.id === stepId)?.name
  } catch {
    return undefined
  }
}

/**
 * Resolve a stepId to its name using a pathId directly (when partId isn't available).
 * Returns undefined if the lookup fails.
 */
export function resolveStepNameByPath(pathId: string, stepId: string): string | undefined {
  try {
    const path = getRepositories().paths.getById(pathId)
    if (!path) return undefined
    return path.steps.find(s => s.id === stepId)?.name
  } catch {
    return undefined
  }
}

/**
 * Resolve a partId to its full path + job context for webhook payload
 * enrichment. Returning this bundle lets n8n workflows branch on the
 * path name (e.g. "route by path" nodes) without chasing the API.
 *
 * For batch events, callers should pass the first partId — all parts
 * in a single request share a path/job in every current call site.
 *
 * Returns undefined if any lookup fails; callers should spread the
 * result conditionally so missing info doesn't break the payload.
 */
export function resolvePathInfo(partId: string): {
  pathId: string
  pathName: string
  jobId: string
  jobName: string
} | undefined {
  try {
    const part = getRepositories().parts.getById(partId)
    if (!part) return undefined
    const path = getRepositories().paths.getById(part.pathId)
    if (!path) return undefined
    const job = getRepositories().jobs.getById(part.jobId)
    if (!job) return undefined
    return {
      pathId: path.id,
      pathName: path.name,
      jobId: job.id,
      jobName: job.name,
    }
  } catch {
    return undefined
  }
}

/**
 * Resolve just the path name/id for a partId. Lighter-weight than
 * resolvePathInfo when the caller doesn't also need job context.
 */
export function resolvePathInfoByPath(pathId: string): {
  pathId: string
  pathName: string
  jobId: string
  jobName: string
} | undefined {
  try {
    const path = getRepositories().paths.getById(pathId)
    if (!path) return undefined
    const job = getRepositories().jobs.getById(path.jobId)
    if (!job) return undefined
    return {
      pathId: path.id,
      pathName: path.name,
      jobId: job.id,
      jobName: job.name,
    }
  } catch {
    return undefined
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

  if (data.pathName) parts.push(`path: ${data.pathName}`)
  if (data.jobName) parts.push(String(data.jobName))

  return parts.join(' | ')
}
