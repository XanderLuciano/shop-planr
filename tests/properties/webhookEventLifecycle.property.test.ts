/**
 * Property tests for webhook event lifecycle.
 *
 * - Property 1: Queue → markSent produces sent status with sentAt timestamp
 * - Property 2: Queue → markFailed increments retryCount monotonically
 * - Property 3: requeueAllFailed resets all failed events to queued
 * - Property 4: getQueueStats counts are consistent with actual event statuses
 * - Property 5: Config update merge preserves unspecified fields
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbQueueEventInput, arbQueueEventBatch, arbConfigUpdate } from './arbitraries/webhook'
import { createWebhookTestService, WEBHOOK_ADMIN_USER } from './helpers/webhookTestHarness'

const ADMIN_ID = WEBHOOK_ADMIN_USER.id

describe('Property 1: Queue → markSent produces sent status', () => {
  it('every queued event transitions to sent with a sentAt timestamp', () => {
    fc.assert(
      fc.property(arbQueueEventInput, (input) => {
        const { service } = createWebhookTestService()
        const queued = service.queueEvent(input)
        expect(queued.status).toBe('queued')

        const sent = service.markSent(queued.id)
        expect(sent.status).toBe('sent')
        expect(sent.sentAt).toBeTruthy()
        expect(sent.lastError).toBeUndefined()
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 2: markFailed increments retryCount monotonically', () => {
  it('each markFailed call increments retryCount by exactly 1', () => {
    fc.assert(
      fc.property(
        arbQueueEventInput,
        fc.integer({ min: 1, max: 10 }),
        (input, failCount) => {
          const { service } = createWebhookTestService()
          const event = service.queueEvent(input)

          for (let i = 1; i <= failCount; i++) {
            const failed = service.markFailed(event.id, `error ${i}`)
            expect(failed.retryCount).toBe(i)
            expect(failed.status).toBe('failed')
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 3: requeueAllFailed resets all failed to queued', () => {
  it('after requeueAllFailed, zero events have failed status', () => {
    fc.assert(
      fc.property(arbQueueEventBatch, (inputs) => {
        const { service } = createWebhookTestService()
        const events = inputs.map(i => service.queueEvent(i))

        // Fail roughly half
        const toFail = events.filter((_, i) => i % 2 === 0)
        for (const e of toFail) {
          service.markFailed(e.id, 'test error')
        }

        const requeued = service.requeueAllFailed(ADMIN_ID)
        expect(requeued).toBe(toFail.length)

        const stats = service.getQueueStats()
        expect(stats.failed).toBe(0)
        expect(stats.queued).toBe(events.length)
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 4: getQueueStats counts are consistent', () => {
  it('sum of stats equals total event count', () => {
    fc.assert(
      fc.property(arbQueueEventBatch, (inputs) => {
        const { service } = createWebhookTestService()
        const events = inputs.map(i => service.queueEvent(i))

        // Apply random status transitions
        for (let i = 0; i < events.length; i++) {
          if (i % 3 === 0) service.markSent(events[i].id)
          else if (i % 3 === 1) service.markFailed(events[i].id, 'err')
          // else stays queued
        }

        const stats = service.getQueueStats()
        expect(stats.queued + stats.sent + stats.failed + stats.cancelled).toBe(events.length)
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 5: Config update merge preserves unspecified fields', () => {
  it('fields not in the update retain their previous values', () => {
    fc.assert(
      fc.property(arbConfigUpdate, arbConfigUpdate, (first, second) => {
        const { service } = createWebhookTestService()

        // Apply first update
        service.updateConfig(ADMIN_ID, first)
        const afterFirst = service.getConfig()

        // Apply second update
        service.updateConfig(ADMIN_ID, second)
        const afterSecond = service.getConfig()

        // Fields not in second update should match afterFirst
        if (second.endpointUrl === undefined) {
          expect(afterSecond.endpointUrl).toBe(afterFirst.endpointUrl)
        }
        if (second.isActive === undefined) {
          expect(afterSecond.isActive).toBe(afterFirst.isActive)
        }
        if (second.enabledEventTypes === undefined) {
          expect(afterSecond.enabledEventTypes).toEqual(afterFirst.enabledEventTypes)
        }
      }),
      { numRuns: 100 },
    )
  })
})
