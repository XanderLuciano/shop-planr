/**
 * Property tests for webhook registration service.
 *
 * - Property 1: Registration creation preserves input
 * - Property 2: Registration list ordering
 * - Property 3: Invalid registration input rejection
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import { ValidationError } from '~/server/utils/errors'
import { createWebhookRegistrationService } from '~/server/services/webhookRegistrationService'
import {
  createInMemoryRegistrationRepo,
  createInMemoryDeliveryRepo,
  createInMemoryUserRepo,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from './helpers/webhookTestHarness'

// ---- Arbitraries ----

/** Arbitrary non-empty trimmed name (1–100 chars). */
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
const arbValidRegistrationInput = fc.record({
  name: arbRegistrationName,
  url: arbRegistrationUrl,
  eventTypes: arbEventTypes,
})

// ---- Helper to create a fresh service ----

function createTestRegistrationService() {
  const registrationRepo = createInMemoryRegistrationRepo()
  const deliveryRepo = createInMemoryDeliveryRepo()
  const userRepo = createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

  const service = createWebhookRegistrationService({
    webhookRegistrations: registrationRepo,
    webhookDeliveries: deliveryRepo,
    users: userRepo,
  })

  return { service, registrationRepo }
}

// ---- Property 1 ----

describe('Property 1: Registration creation preserves input', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * For any valid registration input, creating a registration and then
   * retrieving it by ID should produce a record whose name, url, and
   * eventTypes match the original input.
   */
  it('create + getById round-trips name, url, and eventTypes', () => {
    fc.assert(
      fc.property(arbValidRegistrationInput, (input) => {
        const { service } = createTestRegistrationService()

        const created = service.create(WEBHOOK_ADMIN_USER.id, input)

        // ID should be generated with the whr prefix
        expect(created.id).toMatch(/^whr_/)

        // Retrieve by ID
        const retrieved = service.getById(created.id)

        // Core fields must match input (name/url are trimmed by the service)
        expect(retrieved.name).toBe(input.name.trim())
        expect(retrieved.url).toBe(input.url.trim())
        expect(retrieved.eventTypes).toEqual(input.eventTypes)

        // Timestamps must be present
        expect(retrieved.createdAt).toBeTruthy()
        expect(retrieved.updatedAt).toBeTruthy()
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 2 ----

describe('Property 2: Registration list ordering', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any set of N registrations created at distinct times, listing all
   * registrations should return them in reverse chronological order (most
   * recently created first).
   */
  it('list returns registrations in reverse chronological order', () => {
    fc.assert(
      fc.property(
        fc.array(arbValidRegistrationInput, { minLength: 2, maxLength: 8 }),
        (inputs) => {
          const { service } = createTestRegistrationService()

          // Create registrations sequentially — each gets a distinct createdAt
          // because generateId + new Date() advance monotonically within a test.
          const createdIds: string[] = []
          for (const input of inputs) {
            const reg = service.create(WEBHOOK_ADMIN_USER.id, input)
            createdIds.push(reg.id)
          }

          const listed = service.list()

          // Should have all registrations
          expect(listed).toHaveLength(inputs.length)

          // Verify reverse chronological order: createdAt[i] >= createdAt[i+1]
          for (let i = 0; i < listed.length - 1; i++) {
            expect(listed[i].createdAt >= listed[i + 1].createdAt).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 3 ----

describe('Property 3: Invalid registration input rejection', () => {
  /**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Empty name, empty URL, or unknown event type → ValidationError,
   * no record created.
   */

  it('rejects empty or whitespace-only name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n'),
        arbRegistrationUrl,
        arbEventTypes,
        (badName, url, eventTypes) => {
          const { service } = createTestRegistrationService()

          expect(() =>
            service.create(WEBHOOK_ADMIN_USER.id, { name: badName, url, eventTypes }),
          ).toThrow(ValidationError)

          // No record should have been created
          expect(service.list()).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects empty or whitespace-only URL', () => {
    fc.assert(
      fc.property(
        arbRegistrationName,
        fc.constantFrom('', '   ', '\t', '\n'),
        arbEventTypes,
        (name, badUrl, eventTypes) => {
          const { service } = createTestRegistrationService()

          expect(() =>
            service.create(WEBHOOK_ADMIN_USER.id, { name, url: badUrl, eventTypes }),
          ).toThrow(ValidationError)

          expect(service.list()).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects unknown event types', () => {
    fc.assert(
      fc.property(
        arbRegistrationName,
        arbRegistrationUrl,
        fc.stringMatching(/^[a-z_]{3,20}$/).filter(
          t => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(t),
        ),
        (name, url, badType) => {
          const { service } = createTestRegistrationService()

          expect(() =>
            service.create(WEBHOOK_ADMIN_USER.id, {
              name,
              url,
              eventTypes: [badType],
            }),
          ).toThrow(ValidationError)

          expect(service.list()).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
