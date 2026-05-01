/**
 * Property tests for n8n automation deploy validation.
 *
 * These tests verify the pre-deploy validation logic without making
 * actual HTTP calls to n8n. The deploy method throws ValidationError
 * before reaching the network when configuration is invalid.
 *
 * - Property 1: Deploy rejects when n8n is not configured
 * - Property 2: Deploy rejects non-existent automations
 * - Property 3: Deploy rejects non-admin users
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import type { WebhookEventType } from '~/server/types/domain'
import { ValidationError, NotFoundError, ForbiddenError } from '~/server/utils/errors'
import {
  createN8nTestService,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
  singleNodeWorkflow,
} from './helpers/n8nTestHarness'

// ---- Arbitraries ----

const arbEventTypes = fc.subarray(
  [...WEBHOOK_EVENT_TYPES],
  { minLength: 1, maxLength: 3 },
) as fc.Arbitrary<WebhookEventType[]>

const arbAutomationName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,20}$/)

/** Arbitrary invalid n8n connection (missing baseUrl or apiKey or disabled) */
const arbInvalidConnection = fc.oneof(
  fc.record({
    baseUrl: fc.constant(''),
    apiKey: fc.stringMatching(/^[a-z0-9]{10,20}$/),
    enabled: fc.constant(true),
  }),
  fc.record({
    baseUrl: fc.stringMatching(/^https?:\/\/[a-z]+\.[a-z]+$/),
    apiKey: fc.constant(''),
    enabled: fc.constant(true),
  }),
  fc.record({
    baseUrl: fc.stringMatching(/^https?:\/\/[a-z]+\.[a-z]+$/),
    apiKey: fc.stringMatching(/^[a-z0-9]{10,20}$/),
    enabled: fc.constant(false),
  }),
)

// ---- Property 1 ----

describe('Property 1: Deploy rejects when n8n is not configured', () => {
  it('throws ValidationError for any invalid connection config', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbInvalidConnection,
        arbAutomationName,
        arbEventTypes,
        async (connection, name, eventTypes) => {
          const { service } = createN8nTestService({ n8nConnection: connection })

          const created = service.create({
            name,
            eventTypes,
            workflowJson: singleNodeWorkflow(),
          }, WEBHOOK_ADMIN_USER.id)

          await expect(service.deploy(created.id, WEBHOOK_ADMIN_USER.id))
            .rejects.toThrow(ValidationError)
        },
      ),
      { numRuns: 50 },
    )
  })
})

// ---- Property 2 ----

describe('Property 2: Deploy rejects non-existent automations', () => {
  it('throws NotFoundError for random IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^auto_[a-z0-9]{8}$/),
        async (fakeId) => {
          const { service } = createN8nTestService()

          await expect(service.deploy(fakeId, WEBHOOK_ADMIN_USER.id))
            .rejects.toThrow(NotFoundError)
        },
      ),
      { numRuns: 50 },
    )
  })
})

// ---- Property 3 ----

describe('Property 3: Deploy rejects non-admin users', () => {
  it('throws ForbiddenError for non-admin', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbAutomationName,
        arbEventTypes,
        async (name, eventTypes) => {
          const { service } = createN8nTestService()

          const created = service.create({
            name,
            eventTypes,
            workflowJson: singleNodeWorkflow(),
          }, WEBHOOK_ADMIN_USER.id)

          await expect(service.deploy(created.id, WEBHOOK_REGULAR_USER.id))
            .rejects.toThrow(ForbiddenError)
        },
      ),
      { numRuns: 50 },
    )
  })
})
