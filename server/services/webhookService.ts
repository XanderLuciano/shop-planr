import type { WebhookEventRepository, WebhookConfigRepository } from '../repositories/interfaces/webhookRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { WebhookEvent, WebhookConfig, WebhookEventType } from '../types/domain'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'

export function createWebhookService(repos: {
  webhookEvents: WebhookEventRepository
  webhookConfig: WebhookConfigRepository
  users?: UserRepository
}) {
  return {
    // ---- Event CRUD ----

    /**
     * Queue a webhook event. All events are always recorded regardless
     * of config — the enabled types filter is applied at dispatch time only.
     */
    queueEvent(input: {
      eventType: WebhookEventType
      payload: Record<string, unknown>
      summary: string
    }): WebhookEvent {
      if (!WEBHOOK_EVENT_TYPES.includes(input.eventType)) {
        throw new ValidationError(`Invalid event type: ${input.eventType}`)
      }

      const event: WebhookEvent = {
        id: generateId('whe'),
        eventType: input.eventType,
        payload: input.payload,
        summary: input.summary,
        status: 'queued',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      }

      return repos.webhookEvents.create(event)
    },

    getEvent(id: string): WebhookEvent | undefined {
      return repos.webhookEvents.getById(id)
    },

    listEvents(options?: { limit?: number, offset?: number }): WebhookEvent[] {
      return repos.webhookEvents.list(options)
    },

    listQueuedEvents(limit?: number): WebhookEvent[] {
      return repos.webhookEvents.listByStatus('queued', limit)
    },

    listFailedEvents(limit?: number): WebhookEvent[] {
      return repos.webhookEvents.listByStatus('failed', limit)
    },

    markSent(id: string): WebhookEvent {
      const existing = repos.webhookEvents.getById(id)
      if (!existing) throw new NotFoundError('WebhookEvent', id)
      return repos.webhookEvents.updateStatus(id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
        lastError: undefined,
      })
    },

    markFailed(id: string, error: string): WebhookEvent {
      const existing = repos.webhookEvents.getById(id)
      if (!existing) throw new NotFoundError('WebhookEvent', id)
      return repos.webhookEvents.updateStatus(id, {
        status: 'failed',
        lastError: error,
        retryCount: (existing.retryCount ?? 0) + 1,
      })
    },

    requeueEvent(id: string): WebhookEvent {
      const existing = repos.webhookEvents.getById(id)
      if (!existing) throw new NotFoundError('WebhookEvent', id)
      return repos.webhookEvents.updateStatus(id, {
        status: 'queued',
        lastError: undefined,
      })
    },

    requeueAllFailed(userId: string): number {
      requireAdmin(repos.users, userId, 'retry webhook events')
      let total = 0
      // Loop until no more failed events remain (avoids hardcoded limit)
      while (true) {
        const batch = repos.webhookEvents.listByStatus('failed', 500)
        if (batch.length === 0) break
        for (const event of batch) {
          repos.webhookEvents.updateStatus(event.id, {
            status: 'queued',
            lastError: undefined,
          })
        }
        total += batch.length
      }
      return total
    },

    deleteEvent(id: string): void {
      const existing = repos.webhookEvents.getById(id)
      if (!existing) throw new NotFoundError('WebhookEvent', id)
      repos.webhookEvents.deleteById(id)
    },

    clearAllEvents(userId: string): number {
      requireAdmin(repos.users, userId, 'clear webhook events')
      return repos.webhookEvents.deleteAll()
    },

    getQueueStats(): { queued: number, sent: number, failed: number, cancelled: number } {
      return {
        queued: repos.webhookEvents.countByStatus('queued'),
        sent: repos.webhookEvents.countByStatus('sent'),
        failed: repos.webhookEvents.countByStatus('failed'),
        cancelled: repos.webhookEvents.countByStatus('cancelled'),
      }
    },

    // ---- Config ----

    getConfig(): WebhookConfig {
      const existing = repos.webhookConfig.get()
      if (existing) return existing

      // Return defaults
      return {
        id: 'default',
        endpointUrl: '',
        enabledEventTypes: [],
        enabledSince: {},
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },

    updateConfig(userId: string, input: {
      endpointUrl?: string
      enabledEventTypes?: WebhookEventType[]
      isActive?: boolean
    }): WebhookConfig {
      requireAdmin(repos.users, userId, 'update webhook config')
      const current = this.getConfig()

      if (input.enabledEventTypes) {
        for (const t of input.enabledEventTypes) {
          if (!WEBHOOK_EVENT_TYPES.includes(t)) {
            throw new ValidationError(`Invalid event type: ${t}`)
          }
        }
      }

      // Track enabledSince: when a new event type is added, stamp it with now.
      // Existing types keep their original timestamp. Removed types lose theirs.
      const now = new Date().toISOString()
      const enabledSince = { ...current.enabledSince }
      if (input.enabledEventTypes) {
        const newSet = new Set(input.enabledEventTypes)
        const oldSet = new Set(current.enabledEventTypes)

        // Add timestamps for newly enabled types
        for (const t of newSet) {
          if (!oldSet.has(t)) {
            enabledSince[t] = now
          }
        }
        // Remove timestamps for disabled types — rebuild without removed keys
        // Also mark any still-queued events of that type as 'skipped'
        for (const t of oldSet) {
          if (!newSet.has(t)) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete enabledSince[t]
            repos.webhookEvents.skipQueuedByType(t)
          }
        }
      }

      const updated: WebhookConfig = {
        ...current,
        endpointUrl: input.endpointUrl ?? current.endpointUrl,
        enabledEventTypes: input.enabledEventTypes ?? current.enabledEventTypes,
        enabledSince,
        isActive: input.isActive ?? current.isActive,
        updatedAt: now,
      }

      return repos.webhookConfig.upsert(updated)
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
