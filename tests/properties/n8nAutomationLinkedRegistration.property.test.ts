/**
 * Property tests for n8n automation linked registration behavior.
 *
 * Validates the relationship between automations and their paired
 * webhook registrations — the mechanism that routes events from the
 * delivery pipeline into n8n's webhook trigger.
 *
 * - Property 1: Update syncs name to linked registration
 * - Property 2: Update syncs eventTypes to linked registration
 * - Property 3: Delete cascades to linked registration
 * - Property 4: Delete cancels queued deliveries for linked registration
 * - Property 5: Update without linked registration is a no-op (no crash)
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import type { WebhookEventType } from '~/server/types/domain'
import {
  createN8nTestService,
  WEBHOOK_ADMIN_USER,
  minimalWorkflow,
} from './helpers/n8nTestHarness'

// ---- Arbitraries ----

const arbName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{0,30}$/)

const arbEventTypes = fc.subarray(
  [...WEBHOOK_EVENT_TYPES],
  { minLength: 1, maxLength: 5 },
) as fc.Arbitrary<WebhookEventType[]>

// ---- Helpers ----

function setupWithLinkedRegistration(name: string, eventTypes: WebhookEventType[]) {
  const { service, n8nAutomationRepo, registrationRepo, deliveryRepo } = createN8nTestService()

  const automation = service.create({
    name,
    eventTypes,
    workflowJson: minimalWorkflow(),
  }, WEBHOOK_ADMIN_USER.id)

  // Simulate a deployed state: create a linked registration
  const reg = registrationRepo.create({
    id: `whr_linked_${automation.id}`,
    name: `n8n: ${name}`,
    url: `http://localhost:5678/webhook/shop-planr/${automation.id}`,
    eventTypes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  n8nAutomationRepo.update(automation.id, { linkedRegistrationId: reg.id })

  return { service, automation, reg, registrationRepo, deliveryRepo, n8nAutomationRepo }
}

// ---- Property 1 ----

describe('Property 1: Update syncs name to linked registration', () => {
  it('registration name is updated with n8n: prefix when automation name changes', () => {
    fc.assert(
      fc.property(arbName, arbEventTypes, arbName, (origName, eventTypes, newName) => {
        const { service, automation, reg, registrationRepo } = setupWithLinkedRegistration(origName, eventTypes)

        service.update(automation.id, { name: newName }, WEBHOOK_ADMIN_USER.id)

        const updatedReg = registrationRepo.getById(reg.id)
        expect(updatedReg).toBeDefined()
        expect(updatedReg!.name).toBe(`n8n: ${newName}`)
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 2 ----

describe('Property 2: Update syncs eventTypes to linked registration', () => {
  it('registration eventTypes match automation eventTypes after update', () => {
    fc.assert(
      fc.property(arbName, arbEventTypes, arbEventTypes, (name, origTypes, newTypes) => {
        const { service, automation, reg, registrationRepo } = setupWithLinkedRegistration(name, origTypes)

        service.update(automation.id, { eventTypes: newTypes }, WEBHOOK_ADMIN_USER.id)

        const updatedReg = registrationRepo.getById(reg.id)
        expect(updatedReg).toBeDefined()
        expect(updatedReg!.eventTypes).toEqual(newTypes)
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 3 ----

describe('Property 3: Delete cascades to linked registration', () => {
  it('linked registration is removed when automation is deleted', () => {
    fc.assert(
      fc.property(arbName, arbEventTypes, (name, eventTypes) => {
        const { service, automation, reg, registrationRepo } = setupWithLinkedRegistration(name, eventTypes)

        service.delete(automation.id, WEBHOOK_ADMIN_USER.id)

        expect(registrationRepo.getById(reg.id)).toBeUndefined()
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 4 ----

describe('Property 4: Delete cancels queued deliveries for linked registration', () => {
  it('queued deliveries are canceled when automation is deleted', () => {
    fc.assert(
      fc.property(
        arbName,
        arbEventTypes,
        fc.integer({ min: 1, max: 5 }),
        (name, eventTypes, deliveryCount) => {
          const { service, automation, reg, deliveryRepo } = setupWithLinkedRegistration(name, eventTypes)

          // Create some queued deliveries for the linked registration
          const deliveryIds: string[] = []
          for (let i = 0; i < deliveryCount; i++) {
            const id = `whd_test_${i}_${automation.id}`
            deliveryRepo.create({
              id,
              eventId: `whe_test_${i}`,
              registrationId: reg.id,
              status: 'queued',
              attemptCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            deliveryIds.push(id)
          }

          service.delete(automation.id, WEBHOOK_ADMIN_USER.id)

          // All deliveries should be canceled
          for (const id of deliveryIds) {
            const d = deliveryRepo.getById(id)
            expect(d).toBeDefined()
            expect(d!.status).toBe('canceled')
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})

// ---- Property 5 ----

describe('Property 5: Update without linked registration is a no-op', () => {
  it('updating an automation with no linked registration does not crash', () => {
    fc.assert(
      fc.property(arbName, arbEventTypes, arbName, (origName, eventTypes, newName) => {
        const { service } = createN8nTestService()

        const automation = service.create({
          name: origName,
          eventTypes,
          workflowJson: minimalWorkflow(),
        }, WEBHOOK_ADMIN_USER.id)

        // No linked registration — update should still work
        const updated = service.update(automation.id, { name: newName }, WEBHOOK_ADMIN_USER.id)
        expect(updated.name).toBe(newName)
      }),
      { numRuns: 100 },
    )
  })
})
