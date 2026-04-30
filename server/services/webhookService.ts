import type { WebhookEventRepository } from '../repositories/interfaces/webhookRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { WebhookEvent, WebhookEventType, EventWithDeliveries } from '../types/domain'
import type { WebhookDeliveryService } from './webhookDeliveryService'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'

export function createWebhookService(
  repos: {
    webhookEvents: WebhookEventRepository
    users?: UserRepository
    db: { transaction: <T>(fn: () => T) => () => T }
  },
  deliveryService: WebhookDeliveryService,
) {
  return {
    // ---- Event CRUD ----

    /**
     * Queue a webhook event. All events are always recorded regardless
     * of registrations. After recording, fan-out creates delivery records
     * for all matching registrations.
     *
     * Event creation and delivery fan-out are wrapped in a transaction
     * so we never end up with an event that has no deliveries due to a
     * partial failure.
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
        createdAt: new Date().toISOString(),
      }

      const doWork = () => {
        const created = repos.webhookEvents.create(event)

        // Fan-out: delegate to deliveryService (single source of truth)
        deliveryService.fanOut(created)

        return created
      }

      return repos.db.transaction(doWork)()
    },

    getEvent(id: string): WebhookEvent | undefined {
      return repos.webhookEvents.getById(id)
    },

    listEvents(options?: { limit?: number, offset?: number }): WebhookEvent[] {
      return repos.webhookEvents.list(options)
    },

    /**
     * List events enriched with per-event delivery status summaries.
     * Uses a single JOIN query at the repository level — no JS-side
     * Map assembly or second round-trip.
     */
    listEventsWithDeliveries(options?: { limit?: number, offset?: number }): EventWithDeliveries[] {
      return repos.webhookEvents.listWithDeliverySummaries(options)
    },

    deleteEvent(userId: string, id: string): void {
      requireAdmin(repos.users, userId, 'delete webhook events')
      const existing = repos.webhookEvents.getById(id)
      if (!existing) throw new NotFoundError('WebhookEvent', id)
      repos.webhookEvents.deleteById(id)
    },

    clearAllEvents(userId: string): number {
      requireAdmin(repos.users, userId, 'clear webhook events')
      return repos.webhookEvents.deleteAll()
    },

    getQueueStats(): { total: number } {
      return { total: repos.webhookEvents.count() }
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
