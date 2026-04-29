import type { WebhookDeliveryRepository } from '../repositories/interfaces/webhookDeliveryRepository'
import type { WebhookRegistrationRepository } from '../repositories/interfaces/webhookRegistrationRepository'
import type { WebhookEventRepository } from '../repositories/interfaces/webhookRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { WebhookEvent, WebhookDelivery, WebhookDeliveryStatus } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { ValidationError, NotFoundError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'

/**
 * Valid delivery status transitions.
 *
 * queued → delivering   (dispatch engine picks up)
 * queued → canceled     (admin cancels or registration deleted)
 * delivering → delivered (endpoint returned 2xx)
 * delivering → failed    (endpoint error or non-2xx)
 * failed → queued        (admin retries)
 */
const VALID_TRANSITIONS: Record<string, WebhookDeliveryStatus[]> = {
  queued: ['delivering', 'canceled'],
  delivering: ['delivered', 'failed'],
  failed: ['queued'],
}

function isValidTransition(from: WebhookDeliveryStatus, to: WebhookDeliveryStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function createWebhookDeliveryService(repos: {
  webhookDeliveries: WebhookDeliveryRepository
  webhookRegistrations: WebhookRegistrationRepository
  webhookEvents: WebhookEventRepository
  users: UserRepository
}) {
  return {
    /**
     * Create deliveries for all registrations matching the event type.
     * Called at event creation time (fan-out).
     */
    fanOut(event: WebhookEvent): WebhookDelivery[] {
      const registrations = repos.webhookRegistrations.listByEventType(event.eventType)
      if (registrations.length === 0) return []

      const now = new Date().toISOString()
      const deliveries: WebhookDelivery[] = registrations.map(reg => ({
        id: generateId('whd'),
        eventId: event.id,
        registrationId: reg.id,
        status: 'queued' as WebhookDeliveryStatus,
        createdAt: now,
        updatedAt: now,
      }))

      repos.webhookDeliveries.createMany(deliveries)
      return deliveries
    },

    /**
     * List queued deliveries with joined registration + event info for the dispatch engine.
     */
    listQueued(limit?: number) {
      return repos.webhookDeliveries.listQueued(limit)
    },

    /**
     * Update a single delivery's status with lifecycle validation.
     */
    updateStatus(id: string, status: WebhookDeliveryStatus, error?: string): WebhookDelivery {
      const delivery = repos.webhookDeliveries.getById(id)
      if (!delivery) {
        throw new NotFoundError('WebhookDelivery', id)
      }

      if (!isValidTransition(delivery.status, status)) {
        throw new ValidationError(`Cannot transition from ${delivery.status} to ${status}`)
      }

      return repos.webhookDeliveries.updateStatus(id, status, error)
    },

    /**
     * Batch update delivery statuses with lifecycle validation for each.
     */
    batchUpdateStatus(updates: { id: string, status: WebhookDeliveryStatus, error?: string }[]): void {
      // Validate all transitions before applying any
      for (const update of updates) {
        const delivery = repos.webhookDeliveries.getById(update.id)
        if (!delivery) {
          throw new NotFoundError('WebhookDelivery', update.id)
        }
        if (!isValidTransition(delivery.status, update.status)) {
          throw new ValidationError(`Cannot transition delivery ${update.id} from ${delivery.status} to ${update.status}`)
        }
      }

      // Apply all updates
      for (const update of updates) {
        repos.webhookDeliveries.updateStatus(update.id, update.status, update.error)
      }
    },

    /**
     * Replay an event: create new delivery records for all currently matching registrations.
     * Does not modify existing deliveries.
     */
    replayEvent(userId: string, eventId: string): WebhookDelivery[] {
      requireAdmin(repos.users, userId, 'replay webhook events')

      const event = repos.webhookEvents.getById(eventId)
      if (!event) {
        throw new NotFoundError('WebhookEvent', eventId)
      }

      const registrations = repos.webhookRegistrations.listByEventType(event.eventType)
      if (registrations.length === 0) return []

      const now = new Date().toISOString()
      const deliveries: WebhookDelivery[] = registrations.map(reg => ({
        id: generateId('whd'),
        eventId: event.id,
        registrationId: reg.id,
        status: 'queued' as WebhookDeliveryStatus,
        createdAt: now,
        updatedAt: now,
      }))

      repos.webhookDeliveries.createMany(deliveries)
      return deliveries
    },

    /**
     * Retry failed deliveries for an event: transition each from failed → queued.
     */
    retryFailed(userId: string, eventId: string): WebhookDelivery[] {
      requireAdmin(repos.users, userId, 'retry failed webhook deliveries')

      const failedDeliveries = repos.webhookDeliveries.listFailedByEventId(eventId)
      const retried: WebhookDelivery[] = []

      for (const delivery of failedDeliveries) {
        const updated = repos.webhookDeliveries.updateStatus(delivery.id, 'queued')
        retried.push(updated)
      }

      return retried
    },

    /**
     * Cancel a single queued delivery.
     */
    cancel(id: string): WebhookDelivery {
      const delivery = repos.webhookDeliveries.getById(id)
      if (!delivery) {
        throw new NotFoundError('WebhookDelivery', id)
      }

      if (!isValidTransition(delivery.status, 'canceled')) {
        throw new ValidationError(`Cannot transition from ${delivery.status} to canceled`)
      }

      return repos.webhookDeliveries.updateStatus(id, 'canceled')
    },

    /**
     * Get deliveries for an event (for the event log detail view).
     */
    listByEventId(eventId: string) {
      return repos.webhookDeliveries.listByEventId(eventId)
    },
  }
}

export type WebhookDeliveryService = ReturnType<typeof createWebhookDeliveryService>
