/**
 * Property tests for webhook event lifecycle.
 *
 * - Property 1: Queue creates event with correct fields
 * - Property 2: Events are recorded regardless of registrations
 * - Property 3: Fan-out creates deliveries only for matching registrations
 * - Property 4: getQueueStats total is consistent with actual event count
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbQueueEventInput, arbQueueEventBatch } from './arbitraries/webhook'
import { createWebhookTestService } from './helpers/webhookTestHarness'
import { generateId } from '~/server/utils/idGenerator'
import type { WebhookRegistration } from '~/server/types/domain'

describe('Property 1: Queue creates event with correct fields', () => {
  it('every queued event has an id, eventType, payload, summary, and createdAt', () => {
    fc.assert(
      fc.property(arbQueueEventInput, (input) => {
        const { service } = createWebhookTestService()
        const event = service.queueEvent(input)
        expect(event.id).toMatch(/^whe_/)
        expect(event.eventType).toBe(input.eventType)
        expect(event.payload).toEqual(input.payload)
        expect(event.summary).toBe(input.summary)
        expect(event.createdAt).toBeTruthy()
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 2: Events are recorded regardless of registrations', () => {
  it('events are always created even with no registrations', () => {
    fc.assert(
      fc.property(arbQueueEventBatch, (inputs) => {
        const { service } = createWebhookTestService()
        const events = inputs.map(i => service.queueEvent(i))
        expect(events).toHaveLength(inputs.length)
        for (const event of events) {
          expect(service.getEvent(event.id)).toBeDefined()
        }
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 3: Fan-out creates deliveries only for matching registrations', () => {
  it('delivery count equals matching registration count', () => {
    fc.assert(
      fc.property(arbQueueEventInput, (input) => {
        const { service, registrationRepo, deliveryRepo } = createWebhookTestService()

        // Create some registrations with various event types
        const now = new Date().toISOString()
        const matchingReg: WebhookRegistration = {
          id: generateId('whr'),
          name: 'Matching',
          url: 'https://example.com/match',
          eventTypes: [input.eventType],
          createdAt: now,
          updatedAt: now,
        }
        const nonMatchingReg: WebhookRegistration = {
          id: generateId('whr'),
          name: 'Non-matching',
          url: 'https://example.com/nomatch',
          eventTypes: ['job_deleted'], // unlikely to match most types
          createdAt: now,
          updatedAt: now,
        }
        registrationRepo.create(matchingReg)
        registrationRepo.create(nonMatchingReg)

        const event = service.queueEvent(input)

        const counts = deliveryRepo.countByEventId(event.id)
        // At least the matching registration should have a delivery
        // (nonMatchingReg may also match if input.eventType is 'job_deleted')
        const expectedMatching = [matchingReg, nonMatchingReg].filter(r =>
          r.eventTypes.includes(input.eventType),
        ).length
        expect(counts.queued).toBe(expectedMatching)
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 4: getQueueStats total is consistent', () => {
  it('total equals actual event count', () => {
    fc.assert(
      fc.property(arbQueueEventBatch, (inputs) => {
        const { service } = createWebhookTestService()
        inputs.forEach(i => service.queueEvent(i))

        const stats = service.getQueueStats()
        expect(stats.total).toBe(inputs.length)
      }),
      { numRuns: 50 },
    )
  })
})
