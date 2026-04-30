/**
 * Property tests for webhook delivery lifecycle.
 *
 * - Property 5: Delivery status lifecycle enforcement
 * - Property 7: Retry-failed selectivity
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { WebhookDeliveryStatus } from '~/server/types/domain'
import { createWebhookDeliveryService } from '~/server/services/webhookDeliveryService'
import { ValidationError } from '~/server/utils/errors'
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

// ---- Constants ----

const ALL_STATUSES: WebhookDeliveryStatus[] = ['queued', 'delivering', 'delivered', 'failed', 'canceled']

/**
 * The complete set of valid transitions as defined by the delivery state machine.
 * queued → delivering, queued → canceled
 * delivering → delivered, delivering → failed, delivering → queued, delivering → canceled
 * failed → queued
 */
const VALID_TRANSITIONS: [WebhookDeliveryStatus, WebhookDeliveryStatus][] = [
  ['queued', 'delivering'],
  ['queued', 'canceled'],
  ['delivering', 'delivered'],
  ['delivering', 'failed'],
  ['delivering', 'queued'],
  ['delivering', 'canceled'],
  ['failed', 'queued'],
]

function isValidTransition(from: WebhookDeliveryStatus, to: WebhookDeliveryStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

// ---- Arbitraries ----

const arbDeliveryStatus: fc.Arbitrary<WebhookDeliveryStatus> = fc.constantFrom(...ALL_STATUSES)

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

// ---- Property 5 ----

describe('Property 5: Delivery status lifecycle enforcement', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * For any delivery in a given status and any target status, the transition
   * should succeed only if it follows the allowed lifecycle:
   * {queued→delivering, queued→canceled, delivering→delivered, delivering→failed, failed→queued}.
   * All other transitions should be rejected with a validation error.
   */
  it('only valid transitions succeed; all others are rejected', () => {
    fc.assert(
      fc.property(
        arbDeliveryStatus,
        arbDeliveryStatus,
        arbQueueEventInput,
        arbRegistrationName,
        arbRegistrationUrl,
        arbWebhookEventType,
        (fromStatus, toStatus, eventInput, regName, regUrl, regEventType) => {
          // Build fresh repos and services for each run
          const eventRepo = createInMemoryEventRepo()
          const registrationRepo = createInMemoryRegistrationRepo()
          const deliveryRepo = createInMemoryDeliveryRepo()
          const userRepo = createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

          const deliveryService = createWebhookDeliveryService({
            webhookDeliveries: deliveryRepo,
            webhookRegistrations: registrationRepo,
            webhookEvents: eventRepo,
            users: userRepo,
            db: passthroughDb,
          })

          // Create a registration that matches the event type
          const regId = `whr_test_${regName.slice(0, 8)}`
          registrationRepo.create({
            id: regId,
            name: regName,
            url: regUrl,
            eventTypes: [regEventType],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })

          // Create an event to get a delivery via fan-out
          const event = eventRepo.create({
            id: `whe_test_${Date.now()}`,
            eventType: regEventType,
            payload: eventInput.payload,
            summary: eventInput.summary,
            createdAt: new Date().toISOString(),
          })

          // Fan out to create a delivery in 'queued' status
          const deliveries = deliveryService.fanOut(event)
          expect(deliveries.length).toBeGreaterThan(0)
          const delivery = deliveries[0]

          // Transition the delivery to the desired `fromStatus` using valid transitions
          // We need to walk the state machine to reach `fromStatus`
          const transitioned = walkToStatus(deliveryService, delivery.id, fromStatus)
          if (!transitioned) {
            // If we can't reach the fromStatus, skip this case
            // (e.g., 'delivered' and 'canceled' are terminal — can't transition out)
            return
          }

          // Now attempt the transition from `fromStatus` to `toStatus`
          const valid = isValidTransition(fromStatus, toStatus)

          if (valid) {
            // Should succeed
            const updated = deliveryService.updateStatus(delivery.id, toStatus)
            expect(updated.status).toBe(toStatus)
          } else {
            // Should throw ValidationError
            expect(() => deliveryService.updateStatus(delivery.id, toStatus))
              .toThrow(ValidationError)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Walk a delivery from 'queued' to the target status using valid transitions.
 * Returns true if the target status was reached, false if unreachable.
 */
function walkToStatus(
  deliveryService: ReturnType<typeof createWebhookDeliveryService>,
  deliveryId: string,
  targetStatus: WebhookDeliveryStatus,
): boolean {
  // Delivery starts as 'queued'
  if (targetStatus === 'queued') return true

  // Direct transitions from queued
  if (targetStatus === 'delivering') {
    deliveryService.updateStatus(deliveryId, 'delivering')
    return true
  }
  if (targetStatus === 'canceled') {
    deliveryService.updateStatus(deliveryId, 'canceled')
    return true
  }

  // Transitions that require going through 'delivering' first
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

// ---- Property 7 ----

describe('Property 7: Retry-failed selectivity', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * For any event with deliveries in mixed statuses, calling retryFailed
   * should transition only the "failed" deliveries to "queued" status,
   * leaving all other deliveries (queued, delivering, delivered, canceled) unchanged.
   */
  it('retry-failed only transitions failed deliveries to queued; all others unchanged', () => {
    fc.assert(
      fc.property(
        // Generate a list of desired statuses for deliveries (one per registration)
        fc.array(arbDeliveryStatus, { minLength: 1, maxLength: 8 }),
        arbQueueEventInput,
        (desiredStatuses, eventInput) => {
          const { service, registrationRepo, deliveryRepo } = createWebhookTestService()

          // Create one registration per desired status, all matching the event type
          const regIds: string[] = []
          for (let i = 0; i < desiredStatuses.length; i++) {
            const regId = `whr_test_${i}_${Date.now()}`
            registrationRepo.create({
              id: regId,
              name: `Reg ${i}`,
              url: `https://example-${i}.com/hook`,
              eventTypes: [eventInput.eventType],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            regIds.push(regId)
          }

          // Queue the event — this triggers fan-out, creating one delivery per registration
          const event = service.queueEvent(eventInput)

          // Get the created deliveries
          const deliveries = deliveryRepo.listByEventId(event.id)
          expect(deliveries).toHaveLength(desiredStatuses.length)

          // Walk each delivery to its desired status
          const eventRepo = createInMemoryEventRepo()
          // Copy the event into the delivery service's event repo so retryFailed can find it
          eventRepo.create(event)
          const deliveryService = createWebhookDeliveryService({
            webhookDeliveries: deliveryRepo,
            webhookRegistrations: registrationRepo,
            webhookEvents: eventRepo,
            users: createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER]),
            db: passthroughDb,
          })

          for (let i = 0; i < deliveries.length; i++) {
            walkToStatus(deliveryService, deliveries[i].id, desiredStatuses[i])
          }

          // Snapshot statuses before retryFailed
          const beforeStatuses = new Map<string, WebhookDeliveryStatus>()
          for (const d of deliveries) {
            const current = deliveryRepo.getById(d.id)!
            beforeStatuses.set(d.id, current.status)
          }

          // Call retryFailed
          deliveryService.retryFailed(WEBHOOK_ADMIN_USER.id, event.id)

          // Verify: only failed deliveries changed to queued, all others unchanged
          for (const d of deliveries) {
            const after = deliveryRepo.getById(d.id)!
            const before = beforeStatuses.get(d.id)!

            if (before === 'failed') {
              expect(after.status).toBe('queued')
            } else {
              expect(after.status).toBe(before)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
