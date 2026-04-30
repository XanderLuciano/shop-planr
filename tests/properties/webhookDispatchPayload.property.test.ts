/**
 * Property 10: Dispatch payload completeness
 *
 * For any QueuedDeliveryView, the constructed dispatch payload contains
 * the fields: event (event type), summary, timestamp (eventCreatedAt),
 * plus all keys from the event payload spread at the top level.
 *
 * **Validates: Requirements 5.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbWebhookEventType } from './arbitraries/webhook'
import type { QueuedDeliveryView } from '~/server/types/domain'

// ---- Build dispatch payload (mirrors composable logic) ----

function buildDispatchPayload(view: QueuedDeliveryView): Record<string, unknown> {
  return {
    event: view.eventType,
    summary: view.summary,
    timestamp: view.eventCreatedAt,
    ...view.payload,
  }
}

// ---- Arbitraries ----

const arbId = fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)

const arbIsoDate = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
  .map(ts => new Date(ts).toISOString())

/**
 * Payload keys that do NOT collide with the three reserved top-level fields
 * (event, summary, timestamp). This ensures the spread doesn't overwrite them
 * and the property can verify both reserved and payload keys independently.
 */
const arbPayloadKey = fc
  .stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/)
  .filter(k => k !== 'event' && k !== 'summary' && k !== 'timestamp')

const arbPayload: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  arbPayloadKey,
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { minKeys: 0, maxKeys: 5 },
)

const arbQueuedDeliveryView: fc.Arbitrary<QueuedDeliveryView> = fc.record({
  id: arbId,
  eventId: arbId,
  registrationId: arbId,
  registrationName: fc.string({ minLength: 1, maxLength: 50 }),
  registrationUrl: fc.webUrl(),
  eventType: arbWebhookEventType,
  payload: arbPayload,
  summary: fc.stringMatching(/^[A-Za-z0-9 |→_-]{1,80}$/),
  eventCreatedAt: arbIsoDate,
})

// ---- Property 10 ----

describe('Property 10: Dispatch payload completeness', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * For any QueuedDeliveryView, the dispatch payload must contain:
   * - `event` equal to the view's eventType
   * - `summary` equal to the view's summary
   * - `timestamp` equal to the view's eventCreatedAt
   * - every key from the view's payload present at the top level
   */
  it('dispatch payload contains event, summary, timestamp, and all payload keys', () => {
    fc.assert(
      fc.property(arbQueuedDeliveryView, (view) => {
        const result = buildDispatchPayload(view)

        // Reserved fields are present and correct
        expect(result.event).toBe(view.eventType)
        expect(result.summary).toBe(view.summary)
        expect(result.timestamp).toBe(view.eventCreatedAt)

        // All payload keys are present at the top level with correct values
        for (const key of Object.keys(view.payload)) {
          expect(result).toHaveProperty(key)
          expect(result[key]).toBe(view.payload[key])
        }
      }),
      { numRuns: 100 },
    )
  })

  it('dispatch payload has exactly the expected set of keys', () => {
    fc.assert(
      fc.property(arbQueuedDeliveryView, (view) => {
        const result = buildDispatchPayload(view)

        const expectedKeys = new Set(['event', 'summary', 'timestamp', ...Object.keys(view.payload)])
        const actualKeys = new Set(Object.keys(result))

        expect(actualKeys).toEqual(expectedKeys)
      }),
      { numRuns: 100 },
    )
  })
})
