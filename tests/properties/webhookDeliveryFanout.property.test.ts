/**
 * Property tests for webhook delivery fan-out.
 *
 * - Property 4: Delivery fan-out correctness
 * - Property 6: Registration deletion cascade
 * - Property 8: Replay creates new deliveries
 * - Property 11: Event ID uniqueness
 * - Property 12: No retroactive deliveries
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import type { WebhookDeliveryStatus } from '~/server/types/domain'
import { createWebhookDeliveryService } from '~/server/services/webhookDeliveryService'
import { createWebhookRegistrationService } from '~/server/services/webhookRegistrationService'
import {
  createWebhookTestService,
  createInMemoryEventRepo,
  createInMemoryRegistrationRepo,
  createInMemoryDeliveryRepo,
  createInMemoryUserRepo,
  passthroughDb,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from './helpers/webhookTestHarness'
import { arbWebhookEventType, arbQueueEventInput } from './arbitraries/webhook'

// ---- Arbitraries ----

/** Arbitrary non-empty trimmed name (1–50 chars). */
const arbRegistrationName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{0,49}$/)

/** Arbitrary valid URL. */
const arbRegistrationUrl = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
    fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/),
    fc.constantFrom('com', 'io', 'net', 'org'),
    fc.stringMatching(/^\/[a-z0-9-]{1,20}$/),
  )
  .map(([sub, domain, tld, path]) => `https://${sub}.${domain}.${tld}${path}`)

/** Arbitrary non-empty subset of valid event types. */
const arbEventTypes = fc
  .subarray([...WEBHOOK_EVENT_TYPES], { minLength: 1, maxLength: WEBHOOK_EVENT_TYPES.length })

/** Arbitrary valid registration input. */
const arbRegistrationInput = fc.record({
  name: arbRegistrationName,
  url: arbRegistrationUrl,
  eventTypes: arbEventTypes,
})

// ---- Property 4 ----

describe('Property 4: Delivery fan-out correctness', () => {
  /**
   * **Validates: Requirements 2.4, 2.6, 2.7**
   *
   * For any event type and set of registrations, delivery count equals
   * matching registrations count, all deliveries have status 'queued'.
   */
  it('delivery count equals matching registrations, all statuses are queued', () => {
    fc.assert(
      fc.property(
        fc.array(arbRegistrationInput, { minLength: 0, maxLength: 8 }),
        arbQueueEventInput,
        (registrationInputs, eventInput) => {
          const { service, registrationRepo, deliveryRepo } = createWebhookTestService()

          // Create registrations
          for (const input of registrationInputs) {
            registrationRepo.create({
              id: `whr_test_${Math.random().toString(36).slice(2, 10)}`,
              name: input.name,
              url: input.url,
              eventTypes: input.eventTypes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }

          // Queue the event (triggers fan-out inside webhookService)
          const event = service.queueEvent(eventInput)

          // Count registrations that match the event type
          const matchingRegs = registrationInputs.filter(r =>
            r.eventTypes.includes(eventInput.eventType),
          )

          // Get deliveries for this event
          const deliveries = deliveryRepo.listByEventId(event.id)

          // Delivery count must equal matching registration count
          expect(deliveries).toHaveLength(matchingRegs.length)

          // All deliveries must have status 'queued'
          for (const d of deliveries) {
            expect(d.status).toBe('queued')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 11 ----

describe('Property 11: Event ID uniqueness', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * N events created in sequence all have distinct IDs.
   */
  it('all event IDs are distinct across N sequential events', () => {
    fc.assert(
      fc.property(
        fc.array(arbQueueEventInput, { minLength: 2, maxLength: 20 }),
        (eventInputs) => {
          const { service } = createWebhookTestService()

          const ids: string[] = []
          for (const input of eventInputs) {
            const event = service.queueEvent(input)
            ids.push(event.id)
          }

          // All IDs must be distinct
          const uniqueIds = new Set(ids)
          expect(uniqueIds.size).toBe(ids.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 12 ----

describe('Property 12: No retroactive deliveries', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * Registrations created after events do not receive deliveries
   * for those events.
   */
  it('registrations created after events receive zero deliveries for pre-existing events', () => {
    fc.assert(
      fc.property(
        fc.array(arbQueueEventInput, { minLength: 1, maxLength: 5 }),
        fc.array(arbRegistrationInput, { minLength: 1, maxLength: 5 }),
        (eventInputs, registrationInputs) => {
          const { service, registrationRepo, deliveryRepo } = createWebhookTestService()

          // Phase 1: Queue events BEFORE any registrations exist
          const events = eventInputs.map(input => service.queueEvent(input))

          // Phase 2: Create registrations AFTER events are recorded
          for (const input of registrationInputs) {
            registrationRepo.create({
              id: `whr_test_${Math.random().toString(36).slice(2, 10)}`,
              name: input.name,
              url: input.url,
              eventTypes: input.eventTypes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }

          // Verify: no deliveries exist for any of the pre-existing events
          for (const event of events) {
            const deliveries = deliveryRepo.listByEventId(event.id)
            expect(deliveries).toHaveLength(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Helpers ----

/**
 * Walk a delivery from 'queued' to the target status using valid transitions.
 * Returns true if the target status was reached, false if unreachable.
 */
function walkToStatus(
  deliveryService: ReturnType<typeof createWebhookDeliveryService>,
  deliveryId: string,
  targetStatus: WebhookDeliveryStatus,
): boolean {
  if (targetStatus === 'queued') return true

  if (targetStatus === 'delivering') {
    deliveryService.updateStatus(deliveryId, 'delivering')
    return true
  }
  if (targetStatus === 'canceled') {
    deliveryService.updateStatus(deliveryId, 'canceled')
    return true
  }
  if (targetStatus === 'delivered') {
    deliveryService.updateStatus(deliveryId, 'delivering')
    deliveryService.updateStatus(deliveryId, 'delivered')
    return true
  }
  if (targetStatus === 'failed') {
    deliveryService.updateStatus(deliveryId, 'delivering')
    deliveryService.updateStatus(deliveryId, 'failed')
    return true
  }

  return false
}

// ---- Arbitraries for Properties 6 & 8 ----

/** Arbitrary delivery status to walk deliveries to various states. */
const arbDeliveryStatus: fc.Arbitrary<WebhookDeliveryStatus> = fc.constantFrom(
  'queued' as WebhookDeliveryStatus,
  'delivering' as WebhookDeliveryStatus,
  'delivered' as WebhookDeliveryStatus,
  'failed' as WebhookDeliveryStatus,
  'canceled' as WebhookDeliveryStatus,
)

// ---- Property 6 ----

describe('Property 6: Registration deletion cascade', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any registration with deliveries in mixed statuses (queued, delivering,
   * delivered, failed), deleting the registration should transition all "queued"
   * deliveries to "canceled" while leaving "delivered" and "failed" deliveries
   * unchanged.
   */
  it('deleting a registration cancels queued deliveries, leaves delivered/failed unchanged', () => {
    fc.assert(
      fc.property(
        // Generate desired statuses for deliveries (one event per status → one delivery each)
        fc.array(arbDeliveryStatus, { minLength: 1, maxLength: 8 }),
        arbWebhookEventType,
        arbRegistrationName,
        arbRegistrationUrl,
        (desiredStatuses, eventType, regName, regUrl) => {
          // Build fresh repos
          const eventRepo = createInMemoryEventRepo()
          const registrationRepo = createInMemoryRegistrationRepo()
          const deliveryRepo = createInMemoryDeliveryRepo()
          const userRepo = createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

          const _webhookService = createWebhookTestService([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

          // Create a single registration matching the event type
          const regId = `whr_cascade_${Date.now()}`
          registrationRepo.create({
            id: regId,
            name: regName,
            url: regUrl,
            eventTypes: [eventType],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })

          const deliveryService = createWebhookDeliveryService({
            webhookDeliveries: deliveryRepo,
            webhookRegistrations: registrationRepo,
            webhookEvents: eventRepo,
            users: userRepo,
            db: passthroughDb,
          })

          const registrationService = createWebhookRegistrationService({
            webhookRegistrations: registrationRepo,
            webhookDeliveries: deliveryRepo,
            users: userRepo,
            db: passthroughDb,
          })

          // Create one event per desired status to get one delivery each
          const deliveryIds: string[] = []
          for (const _status of desiredStatuses) {
            const event = eventRepo.create({
              id: `whe_casc_${Math.random().toString(36).slice(2, 10)}`,
              eventType,
              payload: { test: true },
              summary: 'cascade test',
              createdAt: new Date().toISOString(),
            })
            const deliveries = deliveryService.fanOut(event)
            expect(deliveries).toHaveLength(1)
            deliveryIds.push(deliveries[0].id)
          }

          // Walk each delivery to its desired status
          for (let i = 0; i < deliveryIds.length; i++) {
            walkToStatus(deliveryService, deliveryIds[i], desiredStatuses[i])
          }

          // Snapshot statuses before deletion
          const beforeStatuses = new Map<string, WebhookDeliveryStatus>()
          for (const id of deliveryIds) {
            const d = deliveryRepo.getById(id)!
            beforeStatuses.set(id, d.status)
          }

          // Delete the registration (should cascade: cancel queued, leave others)
          registrationService.delete(WEBHOOK_ADMIN_USER.id, regId)

          // Verify cascade behavior
          for (const id of deliveryIds) {
            const after = deliveryRepo.getById(id)!
            const before = beforeStatuses.get(id)!

            if (before === 'queued') {
              // Queued deliveries must become canceled
              expect(after.status).toBe('canceled')
            } else {
              // delivered, failed, delivering, canceled — all unchanged
              expect(after.status).toBe(before)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 8 ----

describe('Property 8: Replay creates new deliveries', () => {
  /**
   * **Validates: Requirements 6.4**
   *
   * For any event and any set of active registrations matching that event's type,
   * replaying the event should create new delivery records (one per matching
   * registration) with status "queued", without modifying existing delivery records.
   */
  it('replaying an event creates new deliveries for all matching registrations without modifying existing ones', () => {
    fc.assert(
      fc.property(
        fc.array(arbRegistrationInput, { minLength: 1, maxLength: 6 }),
        arbQueueEventInput,
        (registrationInputs, eventInput) => {
          const { service, registrationRepo, deliveryRepo } = createWebhookTestService()

          const eventRepo = createInMemoryEventRepo()
          const userRepo = createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

          // Create registrations
          const regIds: string[] = []
          for (const input of registrationInputs) {
            const regId = `whr_replay_${Math.random().toString(36).slice(2, 10)}`
            registrationRepo.create({
              id: regId,
              name: input.name,
              url: input.url,
              eventTypes: input.eventTypes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            regIds.push(regId)
          }

          // Queue the event (triggers initial fan-out)
          const event = service.queueEvent(eventInput)

          // Count matching registrations
          const matchingRegs = registrationInputs.filter(r =>
            r.eventTypes.includes(eventInput.eventType),
          )

          // Get initial deliveries
          const initialDeliveries = deliveryRepo.listByEventId(event.id)
          expect(initialDeliveries).toHaveLength(matchingRegs.length)

          // Snapshot initial delivery IDs and statuses
          const initialDeliverySnapshot = new Map<string, WebhookDeliveryStatus>()
          for (const d of initialDeliveries) {
            initialDeliverySnapshot.set(d.id, d.status)
          }

          // Build a delivery service that shares the same repos as the webhook service
          const deliveryService = createWebhookDeliveryService({
            webhookDeliveries: deliveryRepo,
            webhookRegistrations: registrationRepo,
            webhookEvents: eventRepo,
            users: userRepo,
            db: passthroughDb,
          })

          // We need the event in the delivery service's event repo for replay
          eventRepo.create(event)

          // Replay the event
          const replayedDeliveries = deliveryService.replayEvent(WEBHOOK_ADMIN_USER.id, event.id)

          // Replay should create one new delivery per matching registration
          expect(replayedDeliveries).toHaveLength(matchingRegs.length)

          // All replayed deliveries should have status 'queued'
          for (const d of replayedDeliveries) {
            expect(d.status).toBe('queued')
          }

          // Replayed delivery IDs should be distinct from initial delivery IDs
          for (const d of replayedDeliveries) {
            expect(initialDeliverySnapshot.has(d.id)).toBe(false)
          }

          // Initial deliveries should be unchanged
          for (const [id, originalStatus] of initialDeliverySnapshot) {
            const current = deliveryRepo.getById(id)!
            expect(current.status).toBe(originalStatus)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
