/**
 * Unit tests for webhookDeliveryService.
 *
 * Covers: delivery lifecycle transitions, exponential backoff on failure,
 * attempt counting, nextRetryAt scheduling, batchUpdateStatus validation,
 * replay/retryFailed admin gating, and housekeeping behavior.
 */
import { describe, it, expect } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError } from '~/server/utils/errors'
import { createWebhookDeliveryService } from '~/server/services/webhookDeliveryService'
import {
  createInMemoryEventRepo,
  createInMemoryRegistrationRepo,
  createInMemoryDeliveryRepo,
  createInMemoryUserRepo,
  passthroughDb,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from '../../properties/helpers/webhookTestHarness'
import type { WebhookEvent } from '~/server/types/domain'

function createTestDeliveryService() {
  const eventRepo = createInMemoryEventRepo()
  const registrationRepo = createInMemoryRegistrationRepo()
  const deliveryRepo = createInMemoryDeliveryRepo()
  const userRepo = createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

  const service = createWebhookDeliveryService({
    webhookDeliveries: deliveryRepo,
    webhookRegistrations: registrationRepo,
    webhookEvents: eventRepo,
    users: userRepo,
    db: passthroughDb,
  })

  return { service, eventRepo, registrationRepo, deliveryRepo, userRepo }
}

function createEventAndDelivery(harness: ReturnType<typeof createTestDeliveryService>) {
  const { eventRepo, registrationRepo, service } = harness

  // Create a registration
  registrationRepo.create({
    id: 'whr_test',
    name: 'Test Hook',
    url: 'https://example.com/hook',
    eventTypes: ['part_advanced'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  // Create an event
  const event: WebhookEvent = {
    id: 'whe_test',
    eventType: 'part_advanced',
    payload: { partId: 'p1' },
    summary: 'Test event',
    createdAt: new Date().toISOString(),
  }
  eventRepo.create(event)

  // Fan out to create delivery
  const deliveries = service.fanOut(event)
  return { event, deliveries }
}

describe('WebhookDeliveryService', () => {
  // ---- Fan-out ----

  describe('fanOut', () => {
    it('creates deliveries for matching registrations', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      expect(deliveries).toHaveLength(1)
      expect(deliveries[0].status).toBe('queued')
      expect(deliveries[0].eventId).toBe('whe_test')
      expect(deliveries[0].registrationId).toBe('whr_test')
      expect(deliveries[0].attemptCount).toBe(0)
    })

    it('creates zero deliveries when no registrations match', () => {
      const harness = createTestDeliveryService()
      const { eventRepo, service } = harness

      const event: WebhookEvent = {
        id: 'whe_nomatch',
        eventType: 'job_deleted',
        payload: {},
        summary: 'No match',
        createdAt: new Date().toISOString(),
      }
      eventRepo.create(event)

      const deliveries = service.fanOut(event)
      expect(deliveries).toHaveLength(0)
    })

    it('creates deliveries for multiple matching registrations', () => {
      const harness = createTestDeliveryService()
      const { eventRepo, registrationRepo, service } = harness

      registrationRepo.create({
        id: 'whr_1',
        name: 'Hook 1',
        url: 'https://a.com/hook',
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      registrationRepo.create({
        id: 'whr_2',
        name: 'Hook 2',
        url: 'https://b.com/hook',
        eventTypes: ['job_created', 'part_advanced'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const event: WebhookEvent = {
        id: 'whe_multi',
        eventType: 'job_created',
        payload: {},
        summary: 'Multi',
        createdAt: new Date().toISOString(),
      }
      eventRepo.create(event)

      const deliveries = service.fanOut(event)
      expect(deliveries).toHaveLength(2)
    })
  })

  // ---- Status transitions ----

  describe('updateStatus', () => {
    it('transitions queued → delivering', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      const updated = harness.service.updateStatus(deliveries[0].id, 'delivering')
      expect(updated.status).toBe('delivering')
    })

    it('transitions queued → canceled', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      const updated = harness.service.updateStatus(deliveries[0].id, 'canceled')
      expect(updated.status).toBe('canceled')
    })

    it('transitions delivering → delivered', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'delivering')
      const updated = harness.service.updateStatus(deliveries[0].id, 'delivered')
      expect(updated.status).toBe('delivered')
    })

    it('transitions delivering → failed', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'delivering')
      const updated = harness.service.updateStatus(deliveries[0].id, 'failed', 'Connection refused')
      expect(updated.status).toBe('failed')
    })

    it('transitions failed → queued (retry)', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'delivering')
      harness.service.updateStatus(deliveries[0].id, 'failed')
      const updated = harness.service.updateStatus(deliveries[0].id, 'queued')
      expect(updated.status).toBe('queued')
    })

    it('rejects invalid transition queued → delivered', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      expect(() => harness.service.updateStatus(deliveries[0].id, 'delivered'))
        .toThrow(ValidationError)
    })

    it('rejects invalid transition delivered → queued', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'delivering')
      harness.service.updateStatus(deliveries[0].id, 'delivered')

      expect(() => harness.service.updateStatus(deliveries[0].id, 'queued'))
        .toThrow(ValidationError)
    })

    it('rejects invalid transition canceled → queued', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'canceled')

      expect(() => harness.service.updateStatus(deliveries[0].id, 'queued'))
        .toThrow(ValidationError)
    })

    it('throws NotFoundError for non-existent delivery', () => {
      const harness = createTestDeliveryService()
      expect(() => harness.service.updateStatus('nonexistent', 'delivering'))
        .toThrow(NotFoundError)
    })
  })

  // ---- Attempt counting ----

  describe('attempt counting', () => {
    it('increments attempt count on transition to delivering', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)
      const id = deliveries[0].id

      harness.service.updateStatus(id, 'delivering')
      const d = harness.deliveryRepo.getById(id)!
      expect(d.attemptCount).toBe(1)
    })

    it('increments attempt count on each delivering transition', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)
      const id = deliveries[0].id

      // First attempt
      harness.service.updateStatus(id, 'delivering')
      harness.service.updateStatus(id, 'failed')

      // Retry: failed → queued → delivering
      harness.service.updateStatus(id, 'queued')
      harness.service.updateStatus(id, 'delivering')

      const d = harness.deliveryRepo.getById(id)!
      expect(d.attemptCount).toBe(2)
    })
  })

  // ---- Backoff scheduling ----

  describe('backoff scheduling', () => {
    it('sets nextRetryAt on failure', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)
      const id = deliveries[0].id

      harness.service.updateStatus(id, 'delivering')
      harness.service.updateStatus(id, 'failed')

      const d = harness.deliveryRepo.getById(id)!
      expect(d.nextRetryAt).toBeDefined()
      expect(d.nextRetryAt!.length).toBeGreaterThan(0)
    })

    it('clears nextRetryAt on successful delivery', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)
      const id = deliveries[0].id

      harness.service.updateStatus(id, 'delivering')
      harness.service.updateStatus(id, 'delivered')

      const d = harness.deliveryRepo.getById(id)!
      // nextRetryAt should be cleared (empty string or undefined)
      expect(!d.nextRetryAt || d.nextRetryAt === '').toBe(true)
    })

    it('clears nextRetryAt on manual retry (failed → queued)', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)
      const id = deliveries[0].id

      harness.service.updateStatus(id, 'delivering')
      harness.service.updateStatus(id, 'failed')

      // Verify nextRetryAt was set
      let d = harness.deliveryRepo.getById(id)!
      expect(d.nextRetryAt).toBeDefined()

      // Retry
      harness.service.updateStatus(id, 'queued')
      d = harness.deliveryRepo.getById(id)!
      expect(!d.nextRetryAt || d.nextRetryAt === '').toBe(true)
    })

    it('backoff increases with attempt count', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)
      const id = deliveries[0].id

      // First failure
      harness.service.updateStatus(id, 'delivering')
      harness.service.updateStatus(id, 'failed')
      const d1 = harness.deliveryRepo.getById(id)!
      const retry1 = new Date(d1.nextRetryAt!).getTime()

      // Retry and fail again
      harness.service.updateStatus(id, 'queued')
      harness.service.updateStatus(id, 'delivering')
      harness.service.updateStatus(id, 'failed')
      const d2 = harness.deliveryRepo.getById(id)!
      const retry2 = new Date(d2.nextRetryAt!).getTime()

      // Second backoff should be longer than first
      const now = Date.now()
      const delay1 = retry1 - now
      const delay2 = retry2 - now
      expect(delay2).toBeGreaterThan(delay1)
    })
  })

  // ---- Batch update ----

  describe('batchUpdateStatus', () => {
    it('updates multiple deliveries in one call', () => {
      const harness = createTestDeliveryService()
      const { registrationRepo, eventRepo, service, deliveryRepo } = harness

      registrationRepo.create({
        id: 'whr_batch1',
        name: 'Hook 1',
        url: 'https://a.com',
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      registrationRepo.create({
        id: 'whr_batch2',
        name: 'Hook 2',
        url: 'https://b.com',
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const event: WebhookEvent = {
        id: 'whe_batch',
        eventType: 'job_created',
        payload: {},
        summary: 'Batch test',
        createdAt: new Date().toISOString(),
      }
      eventRepo.create(event)
      const deliveries = service.fanOut(event)
      expect(deliveries).toHaveLength(2)

      // Batch transition to delivering
      service.batchUpdateStatus(deliveries.map(d => ({
        id: d.id,
        status: 'delivering' as const,
      })))

      for (const d of deliveries) {
        const updated = deliveryRepo.getById(d.id)!
        expect(updated.status).toBe('delivering')
      }
    })

    it('rejects batch if any transition is invalid', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      // Try to transition directly to 'delivered' (invalid from 'queued')
      expect(() => harness.service.batchUpdateStatus([
        { id: deliveries[0].id, status: 'delivered' },
      ])).toThrow(ValidationError)
    })

    it('throws NotFoundError if any delivery ID is missing', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      expect(() => harness.service.batchUpdateStatus([
        { id: deliveries[0].id, status: 'delivering' },
        { id: 'nonexistent', status: 'delivering' },
      ])).toThrow(NotFoundError)
    })

    it('increments attempt count for delivering transitions in batch', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.batchUpdateStatus([
        { id: deliveries[0].id, status: 'delivering' },
      ])

      const d = harness.deliveryRepo.getById(deliveries[0].id)!
      expect(d.attemptCount).toBe(1)
    })

    it('handles empty array gracefully', () => {
      const harness = createTestDeliveryService()
      expect(() => harness.service.batchUpdateStatus([])).not.toThrow()
    })
  })

  // ---- Replay ----

  describe('replayEvent', () => {
    it('creates new deliveries for all matching registrations', () => {
      const harness = createTestDeliveryService()
      const { event, deliveries } = createEventAndDelivery(harness)

      const replayed = harness.service.replayEvent(WEBHOOK_ADMIN_USER.id, event.id)
      expect(replayed).toHaveLength(1)
      expect(replayed[0].status).toBe('queued')
      // New delivery should have different ID
      expect(replayed[0].id).not.toBe(deliveries[0].id)
    })

    it('throws NotFoundError for non-existent event', () => {
      const harness = createTestDeliveryService()
      expect(() => harness.service.replayEvent(WEBHOOK_ADMIN_USER.id, 'nonexistent'))
        .toThrow(NotFoundError)
    })

    it('throws ForbiddenError for non-admin user', () => {
      const harness = createTestDeliveryService()
      const { event } = createEventAndDelivery(harness)

      expect(() => harness.service.replayEvent(WEBHOOK_REGULAR_USER.id, event.id))
        .toThrow(ForbiddenError)
    })

    it('does not modify existing deliveries', () => {
      const harness = createTestDeliveryService()
      const { event, deliveries } = createEventAndDelivery(harness)

      // Advance original delivery
      harness.service.updateStatus(deliveries[0].id, 'delivering')
      harness.service.updateStatus(deliveries[0].id, 'delivered')

      // Replay
      harness.service.replayEvent(WEBHOOK_ADMIN_USER.id, event.id)

      // Original should still be delivered
      const original = harness.deliveryRepo.getById(deliveries[0].id)!
      expect(original.status).toBe('delivered')
    })
  })

  // ---- Retry failed ----

  describe('retryFailed', () => {
    it('transitions failed deliveries to queued', () => {
      const harness = createTestDeliveryService()
      const { event, deliveries } = createEventAndDelivery(harness)

      // Fail the delivery
      harness.service.updateStatus(deliveries[0].id, 'delivering')
      harness.service.updateStatus(deliveries[0].id, 'failed')

      const retried = harness.service.retryFailed(WEBHOOK_ADMIN_USER.id, event.id)
      expect(retried).toHaveLength(1)
      expect(retried[0].status).toBe('queued')
    })

    it('only retries failed deliveries, not delivered ones', () => {
      const harness = createTestDeliveryService()
      const { registrationRepo, eventRepo, service, deliveryRepo } = harness

      registrationRepo.create({
        id: 'whr_r1',
        name: 'Hook 1',
        url: 'https://a.com',
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      registrationRepo.create({
        id: 'whr_r2',
        name: 'Hook 2',
        url: 'https://b.com',
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const event: WebhookEvent = {
        id: 'whe_retry',
        eventType: 'job_created',
        payload: {},
        summary: 'Retry test',
        createdAt: new Date().toISOString(),
      }
      eventRepo.create(event)
      const deliveries = service.fanOut(event)

      // Deliver first, fail second
      service.updateStatus(deliveries[0].id, 'delivering')
      service.updateStatus(deliveries[0].id, 'delivered')
      service.updateStatus(deliveries[1].id, 'delivering')
      service.updateStatus(deliveries[1].id, 'failed')

      const retried = service.retryFailed(WEBHOOK_ADMIN_USER.id, event.id)
      expect(retried).toHaveLength(1)
      expect(retried[0].id).toBe(deliveries[1].id)

      // First delivery should still be delivered
      const d1 = deliveryRepo.getById(deliveries[0].id)!
      expect(d1.status).toBe('delivered')
    })

    it('throws NotFoundError for non-existent event', () => {
      const harness = createTestDeliveryService()
      expect(() => harness.service.retryFailed(WEBHOOK_ADMIN_USER.id, 'nonexistent'))
        .toThrow(NotFoundError)
    })

    it('throws ForbiddenError for non-admin user', () => {
      const harness = createTestDeliveryService()
      const { event } = createEventAndDelivery(harness)

      expect(() => harness.service.retryFailed(WEBHOOK_REGULAR_USER.id, event.id))
        .toThrow(ForbiddenError)
    })

    it('returns empty array when no failed deliveries exist', () => {
      const harness = createTestDeliveryService()
      const { event } = createEventAndDelivery(harness)

      const retried = harness.service.retryFailed(WEBHOOK_ADMIN_USER.id, event.id)
      expect(retried).toHaveLength(0)
    })
  })

  // ---- Cancel ----

  describe('cancel', () => {
    it('cancels a queued delivery', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      const canceled = harness.service.cancel(deliveries[0].id)
      expect(canceled.status).toBe('canceled')
    })

    it('cancels a delivering delivery', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'delivering')
      const canceled = harness.service.cancel(deliveries[0].id)
      expect(canceled.status).toBe('canceled')
    })

    it('throws ValidationError when canceling a delivered delivery', () => {
      const harness = createTestDeliveryService()
      const { deliveries } = createEventAndDelivery(harness)

      harness.service.updateStatus(deliveries[0].id, 'delivering')
      harness.service.updateStatus(deliveries[0].id, 'delivered')

      expect(() => harness.service.cancel(deliveries[0].id))
        .toThrow(ValidationError)
    })

    it('throws NotFoundError for non-existent delivery', () => {
      const harness = createTestDeliveryService()
      expect(() => harness.service.cancel('nonexistent'))
        .toThrow(NotFoundError)
    })
  })
})
