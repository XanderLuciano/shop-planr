import type { WebhookEventRepository } from '../repositories/interfaces/webhookRepository'
import type { WebhookRegistrationRepository } from '../repositories/interfaces/webhookRegistrationRepository'
import type { WebhookDeliveryRepository } from '../repositories/interfaces/webhookDeliveryRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { WebhookEvent, WebhookEventType, WebhookDelivery, WebhookDeliveryStatus } from '../types/domain'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'

export function createWebhookService(repos: {
  webhookEvents: WebhookEventRepository
  webhookRegistrations: WebhookRegistrationRepository
  webhookDeliveries: WebhookDeliveryRepository
  users?: UserRepository
}) {
  return {
    // ---- Event CRUD ----

    /**
     * Queue a webhook event. All events are always recorded regardless
     * of registrations. After recording, fan-out creates delivery records
     * for all matching registrations.
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

      const created = repos.webhookEvents.create(event)

      // Fan-out: create delivery records for all matching registrations
      const registrations = repos.webhookRegistrations.listByEventType(created.eventType)
      if (registrations.length > 0) {
        const now = new Date().toISOString()
        const deliveries: WebhookDelivery[] = registrations.map(reg => ({
          id: generateId('whd'),
          eventId: created.id,
          registrationId: reg.id,
          status: 'queued' as WebhookDeliveryStatus,
          createdAt: now,
          updatedAt: now,
        }))
        repos.webhookDeliveries.createMany(deliveries)
      }

      return created
    },

    getEvent(id: string): WebhookEvent | undefined {
      return repos.webhookEvents.getById(id)
    },

    listEvents(options?: { limit?: number, offset?: number }): WebhookEvent[] {
      return repos.webhookEvents.list(options)
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

    getQueueStats(): { total: number } {
      const events = repos.webhookEvents.list({ limit: 999999 })
      return { total: events.length }
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
