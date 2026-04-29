/**
 * Shared fast-check arbitraries for webhook property tests.
 */
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import type { WebhookEventType } from '~/server/types/domain'

/** Arbitrary that produces a valid webhook event type. */
export const arbWebhookEventType: fc.Arbitrary<WebhookEventType> = fc.constantFrom(
  ...WEBHOOK_EVENT_TYPES,
)

/** Arbitrary that produces a valid webhook event queue input. */
export const arbQueueEventInput = fc.record({
  eventType: arbWebhookEventType,
  payload: fc.dictionary(
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/),
    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
    { minKeys: 0, maxKeys: 5 },
  ),
  summary: fc.stringMatching(/^[A-Za-z0-9 |→_-]{1,80}$/),
})

/** Arbitrary that produces a batch of queue event inputs. */
export const arbQueueEventBatch = fc.array(arbQueueEventInput, { minLength: 1, maxLength: 10 })

/** Arbitrary that produces a valid webhook config update. */
export const arbConfigUpdate = fc.record({
  endpointUrl: fc.option(fc.webUrl(), { nil: undefined }),
  enabledEventTypes: fc.option(
    fc.subarray([...WEBHOOK_EVENT_TYPES], { minLength: 0 }),
    { nil: undefined },
  ),
  isActive: fc.option(fc.boolean(), { nil: undefined }),
})
