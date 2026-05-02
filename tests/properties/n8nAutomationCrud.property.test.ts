/**
 * Property tests for n8n automation service CRUD operations.
 *
 * - Property 1: Create + getById round-trips all fields
 * - Property 2: Update preserves unmodified fields
 * - Property 3: Delete removes automation and linked registration
 * - Property 4: Admin gating rejects non-admin users
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import type { WebhookEventType, N8nWorkflowDefinition } from '~/server/types/domain'
import { ForbiddenError, NotFoundError } from '~/server/utils/errors'
import {
  createN8nTestService,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from './helpers/n8nTestHarness'

// ---- Arbitraries ----

const arbAutomationName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{0,49}$/)

const arbDescription = fc.stringMatching(/^[A-Za-z0-9 .,!?-]{0,100}$/)

const arbEventTypes = fc.subarray(
  [...WEBHOOK_EVENT_TYPES],
  { minLength: 1, maxLength: 5 },
) as fc.Arbitrary<WebhookEventType[]>

const arbWorkflowJson: fc.Arbitrary<N8nWorkflowDefinition> = fc.record({
  nodes: fc.array(
    fc.record({
      id: fc.stringMatching(/^node-[a-z0-9]{4}$/),
      name: fc.stringMatching(/^[A-Za-z ]{3,20}$/),
      type: fc.constantFrom(
        'n8n-nodes-base.httpRequest',
        'n8n-nodes-base.slack',
        'n8n-nodes-base.set',
        'n8n-nodes-base.code',
        'n8n-nodes-base.if',
      ),
      typeVersion: fc.constantFrom(1, 2, 3, 4),
      position: fc.tuple(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })) as fc.Arbitrary<[number, number]>,
      parameters: fc.constant({} as Record<string, unknown>),
    }),
    { minLength: 0, maxLength: 5 },
  ),
  connections: fc.constant({} as Record<string, unknown>),
})

const arbCreateInput = fc.record({
  name: arbAutomationName,
  description: arbDescription,
  eventTypes: arbEventTypes,
  workflowJson: arbWorkflowJson,
  enabled: fc.boolean(),
})

// ---- Property 1 ----

describe('Property 1: Create + getById round-trips all fields', () => {
  it('created automation is retrievable with matching fields', () => {
    fc.assert(
      fc.property(arbCreateInput, (input) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)

        expect(created.id).toMatch(/^auto_/)
        expect(created.name).toBe(input.name)
        expect(created.description).toBe(input.description)
        expect(created.eventTypes).toEqual(input.eventTypes)
        expect(created.workflowJson).toEqual(input.workflowJson)
        expect(created.enabled).toBe(input.enabled)
        expect(created.n8nWorkflowId).toBeNull()
        expect(created.linkedRegistrationId).toBeNull()

        // Retrieve by ID
        const retrieved = service.getById(created.id)
        expect(retrieved.id).toBe(created.id)
        expect(retrieved.name).toBe(input.name)
        expect(retrieved.eventTypes).toEqual(input.eventTypes)
        expect(retrieved.workflowJson).toEqual(input.workflowJson)
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 2 ----

describe('Property 2: Update preserves unmodified fields', () => {
  it('updating name preserves all other fields', () => {
    fc.assert(
      fc.property(arbCreateInput, arbAutomationName, (input, newName) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)
        const updated = service.update(created.id, { name: newName }, WEBHOOK_ADMIN_USER.id)

        expect(updated.name).toBe(newName)
        // Other fields unchanged
        expect(updated.description).toBe(input.description)
        expect(updated.eventTypes).toEqual(input.eventTypes)
        expect(updated.workflowJson).toEqual(input.workflowJson)
        expect(updated.enabled).toBe(input.enabled)
      }),
      { numRuns: 100 },
    )
  })

  it('updating eventTypes preserves all other fields', () => {
    fc.assert(
      fc.property(arbCreateInput, arbEventTypes, (input, newEventTypes) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)
        const updated = service.update(created.id, { eventTypes: newEventTypes }, WEBHOOK_ADMIN_USER.id)

        expect(updated.eventTypes).toEqual(newEventTypes)
        expect(updated.name).toBe(input.name)
        expect(updated.description).toBe(input.description)
        expect(updated.workflowJson).toEqual(input.workflowJson)
      }),
      { numRuns: 100 },
    )
  })

  it('updating enabled preserves all other fields', () => {
    fc.assert(
      fc.property(arbCreateInput, fc.boolean(), (input, newEnabled) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)
        const updated = service.update(created.id, { enabled: newEnabled }, WEBHOOK_ADMIN_USER.id)

        expect(updated.enabled).toBe(newEnabled)
        expect(updated.name).toBe(input.name)
        expect(updated.eventTypes).toEqual(input.eventTypes)
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 3 ----

describe('Property 3: Delete removes automation and linked registration', () => {
  it('deleted automation is no longer retrievable', () => {
    fc.assert(
      fc.property(arbCreateInput, (input) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)
        service.delete(created.id, WEBHOOK_ADMIN_USER.id)

        expect(() => service.getById(created.id)).toThrow(NotFoundError)
      }),
      { numRuns: 100 },
    )
  })

  it('delete with linked registration removes the registration', () => {
    fc.assert(
      fc.property(arbCreateInput, (input) => {
        const { service, n8nAutomationRepo, registrationRepo } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)

        // Simulate a linked registration
        const reg = registrationRepo.create({
          id: `whr_linked_${created.id}`,
          name: `n8n: ${input.name}`,
          url: `http://localhost:5678/webhook/shop-planr/${created.id}`,
          eventTypes: input.eventTypes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        n8nAutomationRepo.update(created.id, { linkedRegistrationId: reg.id })

        service.delete(created.id, WEBHOOK_ADMIN_USER.id)

        // Registration should be gone
        expect(registrationRepo.getById(reg.id)).toBeUndefined()
      }),
      { numRuns: 50 },
    )
  })
})

// ---- Property 4 ----

describe('Property 4: Admin gating rejects non-admin users', () => {
  it('create throws ForbiddenError for non-admin', () => {
    fc.assert(
      fc.property(arbCreateInput, (input) => {
        const { service } = createN8nTestService()

        expect(() => service.create(input, WEBHOOK_REGULAR_USER.id))
          .toThrow(ForbiddenError)
      }),
      { numRuns: 50 },
    )
  })

  it('update throws ForbiddenError for non-admin', () => {
    fc.assert(
      fc.property(arbCreateInput, arbAutomationName, (input, newName) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)

        expect(() => service.update(created.id, { name: newName }, WEBHOOK_REGULAR_USER.id))
          .toThrow(ForbiddenError)
      }),
      { numRuns: 50 },
    )
  })

  it('delete throws ForbiddenError for non-admin', () => {
    fc.assert(
      fc.property(arbCreateInput, (input) => {
        const { service } = createN8nTestService()

        const created = service.create(input, WEBHOOK_ADMIN_USER.id)

        expect(() => service.delete(created.id, WEBHOOK_REGULAR_USER.id))
          .toThrow(ForbiddenError)
      }),
      { numRuns: 50 },
    )
  })
})
