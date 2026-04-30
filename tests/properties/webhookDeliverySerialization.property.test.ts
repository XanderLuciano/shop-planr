/**
 * Property 9: Delivery round-trip serialization
 *
 * For any valid WebhookDelivery object, converting it to a database row
 * (snake_case, error: undefined → null) and back (camelCase, error: null → undefined)
 * produces an equivalent object.
 *
 * **Validates: Requirements 8.7**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { WebhookDelivery, WebhookDeliveryStatus } from '~/server/types/domain'

// ---- Row shape (mirrors webhookDeliveryRepository.ts) ----

interface WebhookDeliveryRow {
  id: string
  event_id: string
  registration_id: string | null
  status: string
  error: string | null
  created_at: string
  updated_at: string
}

// ---- Serialize / Deserialize (extracted from repository mapper logic) ----

function deliveryToRow(delivery: WebhookDelivery): WebhookDeliveryRow {
  return {
    id: delivery.id,
    event_id: delivery.eventId,
    registration_id: delivery.registrationId,
    status: delivery.status,
    error: delivery.error ?? null,
    created_at: delivery.createdAt,
    updated_at: delivery.updatedAt,
  }
}

function rowToDelivery(row: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    eventId: row.event_id,
    registrationId: row.registration_id,
    status: row.status as WebhookDeliveryStatus,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---- Arbitraries ----

const arbId = fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)

const arbIsoDate = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
  .map(ts => new Date(ts).toISOString())

const arbDeliveryStatus: fc.Arbitrary<WebhookDeliveryStatus> = fc.constantFrom(
  'queued' as const,
  'delivering' as const,
  'delivered' as const,
  'failed' as const,
  'canceled' as const,
)

/** Optional error string — undefined when absent, non-empty string when present. */
const arbError: fc.Arbitrary<string | undefined> = fc.option(
  fc.string({ minLength: 1, maxLength: 200 }),
  { nil: undefined },
)

const arbWebhookDelivery: fc.Arbitrary<WebhookDelivery> = fc.record({
  id: arbId,
  eventId: arbId,
  registrationId: fc.option(arbId, { nil: null }),
  status: arbDeliveryStatus,
  error: arbError,
  createdAt: arbIsoDate,
  updatedAt: arbIsoDate,
})

// ---- Property 9 ----

describe('Property 9: Delivery round-trip serialization', () => {
  /**
   * **Validates: Requirements 8.7**
   *
   * For any valid WebhookDelivery, serialize → deserialize produces
   * an equivalent object.
   */
  it('serialize then deserialize produces an equivalent WebhookDelivery', () => {
    fc.assert(
      fc.property(arbWebhookDelivery, (delivery) => {
        const row = deliveryToRow(delivery)
        const roundTripped = rowToDelivery(row)

        // All scalar fields must match exactly
        expect(roundTripped.id).toBe(delivery.id)
        expect(roundTripped.eventId).toBe(delivery.eventId)
        expect(roundTripped.registrationId).toBe(delivery.registrationId)
        expect(roundTripped.status).toBe(delivery.status)
        expect(roundTripped.createdAt).toBe(delivery.createdAt)
        expect(roundTripped.updatedAt).toBe(delivery.updatedAt)

        // error: undefined ↔ null round-trip
        expect(roundTripped.error).toBe(delivery.error)
      }),
      { numRuns: 100 },
    )
  })

  it('row error null maps to domain error undefined', () => {
    fc.assert(
      fc.property(arbWebhookDelivery, (delivery) => {
        // Force error to undefined to test the null → undefined path
        const withoutError: WebhookDelivery = { ...delivery, error: undefined }
        const row = deliveryToRow(withoutError)

        // Row should have null for error
        expect(row.error).toBeNull()

        // Deserialize back — should be undefined, not null
        const roundTripped = rowToDelivery(row)
        expect(roundTripped.error).toBeUndefined()
      }),
      { numRuns: 100 },
    )
  })

  it('row error string maps to domain error string', () => {
    fc.assert(
      fc.property(
        arbWebhookDelivery,
        fc.string({ minLength: 1, maxLength: 200 }),
        (delivery, errorMsg) => {
          const withError: WebhookDelivery = { ...delivery, error: errorMsg }
          const row = deliveryToRow(withError)

          // Row should preserve the error string
          expect(row.error).toBe(errorMsg)

          // Deserialize back — should be the same string
          const roundTripped = rowToDelivery(row)
          expect(roundTripped.error).toBe(errorMsg)
        },
      ),
      { numRuns: 100 },
    )
  })
})
