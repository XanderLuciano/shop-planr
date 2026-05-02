/**
 * Unit tests for n8nAutomationService.
 *
 * Covers: automation CRUD, admin gating, linked registration management,
 * deploy validation (without actual n8n API calls), and deletion cascade.
 *
 * Uses shared in-memory repos from n8nTestHarness.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError } from '~/server/utils/errors'
import {
  createN8nTestService,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
  minimalWorkflow,
  singleNodeWorkflow,
} from '../../properties/helpers/n8nTestHarness'

type TestHarness = ReturnType<typeof createN8nTestService>

describe('N8nAutomationService', () => {
  let harness: TestHarness

  beforeEach(() => {
    harness = createN8nTestService()
  })

  const svc = () => harness.service
  const autoRepo = () => harness.n8nAutomationRepo
  const regRepo = () => harness.registrationRepo

  // ---- Create ----

  describe('create', () => {
    it('creates an automation with correct fields', () => {
      const result = svc().create({
        name: 'Test Automation',
        description: 'Sends a Slack message',
        eventTypes: ['part_advanced', 'part_completed'],
        workflowJson: singleNodeWorkflow(),
        enabled: false,
      }, WEBHOOK_ADMIN_USER.id)

      expect(result.id).toMatch(/^auto_/)
      expect(result.name).toBe('Test Automation')
      expect(result.description).toBe('Sends a Slack message')
      expect(result.eventTypes).toEqual(['part_advanced', 'part_completed'])
      expect(result.enabled).toBe(false)
      expect(result.n8nWorkflowId).toBeNull()
      expect(result.linkedRegistrationId).toBeNull()
      expect(result.createdAt).toBeTruthy()
      expect(result.updatedAt).toBeTruthy()
    })

    it('defaults description to empty string', () => {
      const result = svc().create({
        name: 'No Desc',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      expect(result.description).toBe('')
    })

    it('defaults enabled to false', () => {
      const result = svc().create({
        name: 'Disabled by default',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      expect(result.enabled).toBe(false)
    })

    it('throws ForbiddenError for non-admin user', () => {
      expect(() => svc().create({
        name: 'Forbidden',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_REGULAR_USER.id)).toThrow(ForbiddenError)
    })

    it('stores the workflow JSON faithfully', () => {
      const workflow = singleNodeWorkflow('n8n-nodes-base.slack')
      const result = svc().create({
        name: 'Slack Notify',
        eventTypes: ['part_advanced'],
        workflowJson: workflow,
      }, WEBHOOK_ADMIN_USER.id)

      expect(result.workflowJson).toEqual(workflow)
    })
  })

  // ---- List ----

  describe('list', () => {
    it('returns all automations', () => {
      svc().create({ name: 'A', eventTypes: ['job_created'], workflowJson: minimalWorkflow() }, WEBHOOK_ADMIN_USER.id)
      svc().create({ name: 'B', eventTypes: ['part_advanced'], workflowJson: minimalWorkflow() }, WEBHOOK_ADMIN_USER.id)

      const list = svc().list()
      expect(list).toHaveLength(2)
    })

    it('returns empty array when none exist', () => {
      expect(svc().list()).toEqual([])
    })
  })

  // ---- GetById ----

  describe('getById', () => {
    it('returns automation by id', () => {
      const created = svc().create({
        name: 'Find Me',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const found = svc().getById(created.id)
      expect(found.id).toBe(created.id)
      expect(found.name).toBe('Find Me')
    })

    it('throws NotFoundError for non-existent id', () => {
      expect(() => svc().getById('nonexistent')).toThrow(NotFoundError)
    })
  })

  // ---- Update ----

  describe('update', () => {
    it('updates name', () => {
      const created = svc().create({
        name: 'Original',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const updated = svc().update(created.id, { name: 'Renamed' }, WEBHOOK_ADMIN_USER.id)
      expect(updated.name).toBe('Renamed')
    })

    it('updates eventTypes', () => {
      const created = svc().create({
        name: 'Test',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const updated = svc().update(created.id, {
        eventTypes: ['part_advanced', 'part_completed'],
      }, WEBHOOK_ADMIN_USER.id)

      expect(updated.eventTypes).toEqual(['part_advanced', 'part_completed'])
    })

    it('updates workflowJson', () => {
      const created = svc().create({
        name: 'Test',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const newWorkflow = singleNodeWorkflow()
      const updated = svc().update(created.id, { workflowJson: newWorkflow }, WEBHOOK_ADMIN_USER.id)
      expect(updated.workflowJson).toEqual(newWorkflow)
    })

    it('updates enabled flag', () => {
      const created = svc().create({
        name: 'Test',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
        enabled: false,
      }, WEBHOOK_ADMIN_USER.id)

      const updated = svc().update(created.id, { enabled: true }, WEBHOOK_ADMIN_USER.id)
      expect(updated.enabled).toBe(true)
    })

    it('throws NotFoundError for non-existent id', () => {
      expect(() => svc().update('nonexistent', { name: 'X' }, WEBHOOK_ADMIN_USER.id))
        .toThrow(NotFoundError)
    })

    it('throws ForbiddenError for non-admin user', () => {
      const created = svc().create({
        name: 'Test',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      expect(() => svc().update(created.id, { name: 'X' }, WEBHOOK_REGULAR_USER.id))
        .toThrow(ForbiddenError)
    })

    it('syncs name change to linked registration', () => {
      // Simulate a deployed automation with a linked registration
      const created = svc().create({
        name: 'Original',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      // Manually create a linked registration
      const reg = regRepo().create({
        id: 'whr_linked',
        name: 'n8n: Original',
        url: 'http://localhost:5678/webhook/shop-planr/' + created.id,
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Link it
      autoRepo().update(created.id, { linkedRegistrationId: reg.id })

      // Update the automation name
      svc().update(created.id, { name: 'Renamed' }, WEBHOOK_ADMIN_USER.id)

      // Verify registration was synced
      const updatedReg = regRepo().getById(reg.id)
      expect(updatedReg!.name).toBe('n8n: Renamed')
    })

    it('syncs eventTypes change to linked registration', () => {
      const created = svc().create({
        name: 'Test',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const reg = regRepo().create({
        id: 'whr_linked2',
        name: 'n8n: Test',
        url: 'http://localhost:5678/webhook/shop-planr/' + created.id,
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      autoRepo().update(created.id, { linkedRegistrationId: reg.id })

      svc().update(created.id, {
        eventTypes: ['part_advanced', 'part_completed'],
      }, WEBHOOK_ADMIN_USER.id)

      const updatedReg = regRepo().getById(reg.id)
      expect(updatedReg!.eventTypes).toEqual(['part_advanced', 'part_completed'])
    })
  })

  // ---- Delete ----

  describe('delete', () => {
    it('removes automation from store', () => {
      const created = svc().create({
        name: 'Delete Me',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      svc().delete(created.id, WEBHOOK_ADMIN_USER.id)
      expect(() => svc().getById(created.id)).toThrow(NotFoundError)
    })

    it('throws NotFoundError for non-existent id', () => {
      expect(() => svc().delete('nonexistent', WEBHOOK_ADMIN_USER.id))
        .toThrow(NotFoundError)
    })

    it('throws ForbiddenError for non-admin user', () => {
      const created = svc().create({
        name: 'Test',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      expect(() => svc().delete(created.id, WEBHOOK_REGULAR_USER.id))
        .toThrow(ForbiddenError)
    })

    it('deletes linked registration on automation delete', () => {
      const created = svc().create({
        name: 'With Link',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const reg = regRepo().create({
        id: 'whr_to_delete',
        name: 'n8n: With Link',
        url: 'http://localhost:5678/webhook/shop-planr/' + created.id,
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      autoRepo().update(created.id, { linkedRegistrationId: reg.id })

      svc().delete(created.id, WEBHOOK_ADMIN_USER.id)

      // Registration should be gone
      expect(regRepo().getById(reg.id)).toBeUndefined()
    })

    it('cancels queued deliveries for linked registration on delete', () => {
      const created = svc().create({
        name: 'With Deliveries',
        eventTypes: ['job_created'],
        workflowJson: minimalWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      const reg = regRepo().create({
        id: 'whr_with_deliveries',
        name: 'n8n: With Deliveries',
        url: 'http://localhost:5678/webhook/shop-planr/' + created.id,
        eventTypes: ['job_created'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      autoRepo().update(created.id, { linkedRegistrationId: reg.id })

      // Add a queued delivery for this registration
      const deliveryRepo = harness.deliveryRepo
      deliveryRepo.create({
        id: 'whd_test',
        eventId: 'whe_test',
        registrationId: reg.id,
        status: 'queued',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      svc().delete(created.id, WEBHOOK_ADMIN_USER.id)

      // Delivery should be canceled
      const delivery = deliveryRepo.getById('whd_test')
      expect(delivery!.status).toBe('canceled')
    })
  })

  // ---- Deploy validation ----

  describe('deploy', () => {
    it('throws ValidationError when n8n is not configured (no baseUrl)', async () => {
      const h = createN8nTestService({
        n8nConnection: { baseUrl: '', apiKey: 'key', enabled: true },
      })

      const created = h.service.create({
        name: 'Deploy Test',
        eventTypes: ['job_created'],
        workflowJson: singleNodeWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      await expect(h.service.deploy(created.id, WEBHOOK_ADMIN_USER.id))
        .rejects.toThrow(ValidationError)
    })

    it('throws ValidationError when n8n is not configured (no apiKey)', async () => {
      const h = createN8nTestService({
        n8nConnection: { baseUrl: 'http://localhost:5678', apiKey: '', enabled: true },
      })

      const created = h.service.create({
        name: 'Deploy Test',
        eventTypes: ['job_created'],
        workflowJson: singleNodeWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      await expect(h.service.deploy(created.id, WEBHOOK_ADMIN_USER.id))
        .rejects.toThrow(ValidationError)
    })

    it('throws ValidationError when n8n is disabled', async () => {
      const h = createN8nTestService({
        n8nConnection: { baseUrl: 'http://localhost:5678', apiKey: 'key', enabled: false },
      })

      const created = h.service.create({
        name: 'Deploy Test',
        eventTypes: ['job_created'],
        workflowJson: singleNodeWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      await expect(h.service.deploy(created.id, WEBHOOK_ADMIN_USER.id))
        .rejects.toThrow(ValidationError)
    })

    it('throws NotFoundError for non-existent automation', async () => {
      await expect(svc().deploy('nonexistent', WEBHOOK_ADMIN_USER.id))
        .rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError for non-admin user', async () => {
      const created = svc().create({
        name: 'Deploy Test',
        eventTypes: ['job_created'],
        workflowJson: singleNodeWorkflow(),
      }, WEBHOOK_ADMIN_USER.id)

      await expect(svc().deploy(created.id, WEBHOOK_REGULAR_USER.id))
        .rejects.toThrow(ForbiddenError)
    })
  })

  // ---- getN8nStatus ----

  describe('getN8nStatus', () => {
    it('returns not connected when baseUrl is empty', async () => {
      const h = createN8nTestService({
        n8nConnection: { baseUrl: '', apiKey: 'key', enabled: true },
      })

      const status = await h.service.getN8nStatus()
      expect(status.connected).toBe(false)
    })

    it('returns not connected when apiKey is empty', async () => {
      const h = createN8nTestService({
        n8nConnection: { baseUrl: 'http://localhost:5678', apiKey: '', enabled: true },
      })

      const status = await h.service.getN8nStatus()
      expect(status.connected).toBe(false)
    })

    it('returns not connected with error when disabled', async () => {
      const h = createN8nTestService({
        n8nConnection: { baseUrl: 'http://localhost:5678', apiKey: 'key', enabled: false },
      })

      const status = await h.service.getN8nStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('disabled')
    })
  })
})
