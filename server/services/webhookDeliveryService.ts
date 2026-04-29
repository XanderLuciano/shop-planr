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
 * delivering → queued    (unstick: browser closed mid-dispatch)
 * delivering → canceled  (admin aborts stuck delivery)
 * failed → queued        (admin retries)
 */
const VALID_TRANSITIONS: Record<string, WebhookDeliveryStatus[]> = {
  queued: ['delivering', 'canceled'],
  delivering: ['delivered', 'failed', 'queued', 'canceled'],
  failed: ['queued'],
}

function isValidTransition(from: WebhookDeliveryStatus, to: WebhookDeliveryStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ---- Tuning constants ----

/** Base delay for exponential backoff on failed deliveries (30 seconds). */
const BACKOFF_BASE_MS = 30_000

/** Maximum backoff delay cap (30 minutes). */
const BACKOFF_MAX_MS = 30 * 60_000

/** Deliveries stuck in 'delivering' longer than this are reset to 'queued'. */
const STUCK_THRESHOLD_MINUTES = 5

/** Delivered/canceled deliveries older than this are purged. */
const RETENTION_DAYS = 30

/**
 * Compute the next retry delay using exponential backoff.
 */
function computeBackoffMs(attemptCount: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, attemptCount), BACKOFF_MAX_MS)
}

export function createWebhookDeliveryService(repos: {
  webhookDeliveries: WebhookDeliveryRepository
  webhookRegistrations: WebhookRegistrationRepository
  webhookEvents: WebhookEventRepository
  users: UserRepository
  db: { transaction: <T>(fn: () => T) => () => T }
}) {
  /**
   * Internal helper: create delivery records for all registrations matching an event type.
   * Used by both fanOut (at event creation) and replayEvent.
   */
  function createDeliveriesForEvent(event: WebhookEvent): WebhookDelivery[] {
    const registrations = repos.webhookRegistrations.listByEventType(event.eventType)
    if (registrations.length === 0) return []

    const now = new Date().toISOString()
    const deliveries: WebhookDelivery[] = registrations.map(reg => ({
      id: generateId('whd'),
      eventId: event.id,
      registrationId: reg.id,
      status: 'queued' as WebhookDeliveryStatus,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    }))

    repos.webhookDeliveries.createMany(deliveries)
    return deliveries
  }

  return {
    /**
     * Create deliveries for all registrations matching the event type.
     * Called at event creation time (fan-out).
     */
    fanOut(event: WebhookEvent): WebhookDelivery[] {
      return createDeliveriesForEvent(event)
    },

    /**
     * List queued deliveries with joined registration + event info for the dispatch engine.
     *
     * Housekeeping runs automatically before returning results:
     * - Resets deliveries stuck in 'delivering' for more than 5 minutes back to 'queued'
     * - Purges delivered/canceled deliveries older than 30 days
     * - Purges orphaned events with no remaining deliveries (older than 30 days)
     */
    listQueued(limit?: number) {
      repos.webhookDeliveries.resetStuckDeliveries(STUCK_THRESHOLD_MINUTES)
      repos.webhookDeliveries.purgeOldDeliveries(RETENTION_DAYS)
      repos.webhookEvents.purgeOrphaned()
      return repos.webhookDeliveries.listQueued(limit)
    },

    /**
     * Update a single delivery's status with lifecycle validation.
     *
     * When transitioning to 'delivering', increments the attempt count.
     * When transitioning to 'failed', computes exponential backoff and
     * sets next_retry_at so the delivery won't be picked up again until
     * the backoff period expires.
     */
    updateStatus(id: string, status: WebhookDeliveryStatus, error?: string): WebhookDelivery {
      const delivery = repos.webhookDeliveries.getById(id)
      if (!delivery) {
        throw new NotFoundError('WebhookDelivery', id)
      }

      if (!isValidTransition(delivery.status, status)) {
        throw new ValidationError(`Cannot transition from ${delivery.status} to ${status}`)
      }

      // Increment attempt count when dispatch begins
      if (status === 'delivering') {
        repos.webhookDeliveries.incrementAttemptCount(id)
      }

      const updated = repos.webhookDeliveries.updateStatus(id, status, error)

      // Set backoff on failure so the delivery isn't immediately re-queued
      if (status === 'failed') {
        const currentAttempts = repos.webhookDeliveries.getById(id)!.attemptCount
        const backoffMs = computeBackoffMs(currentAttempts)
        const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()
        repos.webhookDeliveries.setNextRetryAt(id, nextRetryAt)
      }

      // Clear next_retry_at when successfully delivered or manually re-queued
      if (status === 'delivered' || (status === 'queued' && delivery.status === 'failed')) {
        repos.webhookDeliveries.setNextRetryAt(id, '')
      }

      return updated
    },

    /**
     * Batch update delivery statuses with lifecycle validation for each.
     *
     * Pre-fetches all deliveries in one query, validates transitions against
     * the in-memory map, then applies all updates inside a transaction.
     */
    batchUpdateStatus(updates: { id: string, status: WebhookDeliveryStatus, error?: string }[]): void {
      if (updates.length === 0) return

      // Single query to fetch all deliveries
      const ids = updates.map(u => u.id)
      const deliveries = repos.webhookDeliveries.getManyByIds(ids)
      const deliveryMap = new Map(deliveries.map(d => [d.id, d]))

      // Validate all transitions before applying any
      for (const update of updates) {
        const delivery = deliveryMap.get(update.id)
        if (!delivery) {
          throw new NotFoundError('WebhookDelivery', update.id)
        }
        if (!isValidTransition(delivery.status, update.status)) {
          throw new ValidationError(`Cannot transition delivery ${update.id} from ${delivery.status} to ${update.status}`)
        }
      }

      // Apply all updates in a transaction, with attempt counting and backoff
      const doWork = () => {
        for (const update of updates) {
          const existing = deliveryMap.get(update.id)!

          // Increment attempt count when dispatch begins
          if (update.status === 'delivering') {
            repos.webhookDeliveries.incrementAttemptCount(update.id)
          }

          repos.webhookDeliveries.updateStatus(update.id, update.status, update.error)

          // Set backoff on failure — read the current attempt count from the repo
          if (update.status === 'failed') {
            const currentAttempts = repos.webhookDeliveries.getById(update.id)!.attemptCount
            const backoffMs = computeBackoffMs(currentAttempts)
            const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()
            repos.webhookDeliveries.setNextRetryAt(update.id, nextRetryAt)
          }

          // Clear next_retry_at on success or manual re-queue
          if (update.status === 'delivered' || (update.status === 'queued' && existing.status === 'failed')) {
            repos.webhookDeliveries.setNextRetryAt(update.id, '')
          }
        }
      }

      repos.db.transaction(doWork)()
    },

    /**
     * Replay an event: create new delivery records for all currently matching registrations.
     * Does not modify existing deliveries. Wrapped in a transaction for atomicity.
     */
    replayEvent(userId: string, eventId: string): WebhookDelivery[] {
      requireAdmin(repos.users, userId, 'replay webhook events')

      const event = repos.webhookEvents.getById(eventId)
      if (!event) {
        throw new NotFoundError('WebhookEvent', eventId)
      }

      return repos.db.transaction(() => createDeliveriesForEvent(event))()
    },

    /**
     * Retry failed deliveries for an event: transition each from failed → queued.
     * Clears nextRetryAt so the delivery is immediately eligible for dispatch.
     */
    retryFailed(userId: string, eventId: string): WebhookDelivery[] {
      requireAdmin(repos.users, userId, 'retry failed webhook deliveries')

      const event = repos.webhookEvents.getById(eventId)
      if (!event) {
        throw new NotFoundError('WebhookEvent', eventId)
      }

      const failedDeliveries = repos.webhookDeliveries.listFailedByEventId(eventId)
      const retried: WebhookDelivery[] = []

      for (const delivery of failedDeliveries) {
        const updated = repos.webhookDeliveries.updateStatus(delivery.id, 'queued')
        repos.webhookDeliveries.setNextRetryAt(delivery.id, '')
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

    /**
     * Reset deliveries stuck in 'delivering' status for longer than the
     * given threshold back to 'queued'. This handles the case where a
     * browser tab was closed mid-dispatch.
     */
    resetStuckDeliveries(olderThanMinutes = STUCK_THRESHOLD_MINUTES): number {
      return repos.webhookDeliveries.resetStuckDeliveries(olderThanMinutes)
    },
  }
}

export type WebhookDeliveryService = ReturnType<typeof createWebhookDeliveryService>
