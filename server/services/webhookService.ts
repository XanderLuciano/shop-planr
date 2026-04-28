import type { WebhookEventRepository, WebhookConfigRepository } from '../repositories/interfaces/webhookRepository'
import type { WebhookEvent, WebhookConfig, WebhookEventType } from '../types/domain'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { ValidationError } from '../utils/errors'

export function createWebhookService(repos: {
  webhookEvents: WebhookEventRepository
  webhookConfig: WebhookConfigRepository
}) {
  return {
    // ---- Event CRUD ----

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
      return repos.webhookEvents.updateStatus(id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
        lastError: undefined,
      })
    },

    markFailed(id: string, error: string): WebhookEvent {
      const existing = repos.webhookEvents.getById(id)
      return repos.webhookEvents.updateStatus(id, {
        status: 'failed',
        lastError: error,
        retryCount: (existing?.retryCount ?? 0) + 1,
      })
    },

    requeueEvent(id: string): WebhookEvent {
      return repos.webhookEvents.updateStatus(id, {
        status: 'queued',
        lastError: undefined,
      })
    },

    requeueAllFailed(): number {
      const failed = repos.webhookEvents.listByStatus('failed', 1000)
      for (const event of failed) {
        repos.webhookEvents.updateStatus(event.id, {
          status: 'queued',
          lastError: undefined,
        })
      }
      return failed.length
    },

    deleteEvent(id: string): void {
      repos.webhookEvents.deleteById(id)
    },

    clearAllEvents(): number {
      return repos.webhookEvents.deleteAll()
    },

    getQueueStats(): { queued: number, sent: number, failed: number } {
      return {
        queued: repos.webhookEvents.countByStatus('queued'),
        sent: repos.webhookEvents.countByStatus('sent'),
        failed: repos.webhookEvents.countByStatus('failed'),
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
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },

    updateConfig(input: {
      endpointUrl?: string
      enabledEventTypes?: WebhookEventType[]
      isActive?: boolean
    }): WebhookConfig {
      const current = this.getConfig()

      if (input.enabledEventTypes) {
        for (const t of input.enabledEventTypes) {
          if (!WEBHOOK_EVENT_TYPES.includes(t)) {
            throw new ValidationError(`Invalid event type: ${t}`)
          }
        }
      }

      const updated: WebhookConfig = {
        ...current,
        endpointUrl: input.endpointUrl ?? current.endpointUrl,
        enabledEventTypes: input.enabledEventTypes ?? current.enabledEventTypes,
        isActive: input.isActive ?? current.isActive,
        updatedAt: new Date().toISOString(),
      }

      return repos.webhookConfig.upsert(updated)
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
