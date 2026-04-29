/**
 * Unit tests for webhookService.
 *
 * Covers: event CRUD, validation of event types, admin gating,
 * and fan-out delivery creation for matching registrations.
 *
 * Uses shared in-memory repos from webhookTestHarness.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError } from '~/server/utils/errors'
import { generateId } from '~/server/utils/idGenerator'
import {
  createWebhookTestService,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from '../../properties/helpers/webhookTestHarness'
import type { WebhookRegistration } from '~/server/types/domain'

type TestHarness = ReturnType<typeof createWebhookTestService>

describe('WebhookService', () => {
  let harness: TestHarness

  beforeEach(() => {
    harness = createWebhookTestService()
  })

  // Shorthand accessors
  const svc = () => harness.service
  const eventRepo = () => harness.eventRepo
  const registrationRepo = () => harness.registrationRepo
  const deliveryRepo = () => harness.deliveryRepo

  /** Helper to create a registration in the repo directly */
  function addRegistration(overrides: Partial<WebhookRegistration> = {}): WebhookRegistration {
    const now = new Date().toISOString()
    const reg: WebhookRegistration = {
      id: overrides.id ?? generateId('whr'),
      name: overrides.name ?? 'Test Hook',
      url: overrides.url ?? 'https://example.com/webhook',
      eventTypes: overrides.eventTypes ?? ['part_advanced', 'job_created'],
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    }
    return registrationRepo().create(reg)
  }

  // ---- Event CRUD ----

  describe('queueEvent', () => {
    it('creates an event with correct fields', () => {
      const spy = vi.spyOn(eventRepo(), 'create')
      const event = svc().queueEvent({
        eventType: 'part_advanced',
        payload: { partId: 'p1', stepId: 's1' },
        summary: 'Part advanced to step 2',
      })

      expect(event.id).toMatch(/^whe_/)
      expect(event.eventType).toBe('part_advanced')
      expect(event.payload).toEqual({ partId: 'p1', stepId: 's1' })
      expect(event.summary).toBe('Part advanced to step 2')
      expect(event.createdAt).toBeTruthy()
      expect(spy).toHaveBeenCalledOnce()
    })

    it('rejects invalid event type', () => {
      expect(() => svc().queueEvent({
        eventType: 'invalid_type' as any,
        payload: {},
        summary: 'bad',
      })).toThrow(ValidationError)
    })

    it('accepts all valid event types', () => {
      const types = [
        'part_advanced', 'part_completed', 'part_created', 'part_scrapped',
        'part_force_completed', 'step_skipped', 'step_deferred', 'step_waived',
        'job_created', 'job_deleted', 'path_deleted', 'note_created', 'cert_attached',
      ] as const

      for (const eventType of types) {
        const event = svc().queueEvent({
          eventType,
          payload: { test: true },
          summary: `Test ${eventType}`,
        })
        expect(event.eventType).toBe(eventType)
      }
    })
  })

  describe('queueEvent fan-out', () => {
    it('creates deliveries for matching registrations', () => {
      addRegistration({ eventTypes: ['part_advanced', 'job_created'] })
      addRegistration({ eventTypes: ['part_advanced'] })
      addRegistration({ eventTypes: ['job_deleted'] })

      const event = svc().queueEvent({
        eventType: 'part_advanced',
        payload: { partId: 'p1' },
        summary: 'Part advanced',
      })

      const counts = deliveryRepo().countByEventId(event.id)
      expect(counts.queued).toBe(2)
    })

    it('creates zero deliveries when no registrations match', () => {
      addRegistration({ eventTypes: ['job_deleted'] })

      const event = svc().queueEvent({
        eventType: 'part_advanced',
        payload: {},
        summary: 'test',
      })

      const counts = deliveryRepo().countByEventId(event.id)
      expect(counts.queued).toBe(0)
    })

    it('creates zero deliveries when no registrations exist', () => {
      const event = svc().queueEvent({
        eventType: 'part_advanced',
        payload: {},
        summary: 'test',
      })

      const counts = deliveryRepo().countByEventId(event.id)
      expect(counts.queued).toBe(0)
    })

    it('all fan-out deliveries have status queued', () => {
      addRegistration({ eventTypes: ['job_created'] })
      addRegistration({ eventTypes: ['job_created'] })

      const event = svc().queueEvent({
        eventType: 'job_created',
        payload: {},
        summary: 'Job created',
      })

      const details = deliveryRepo().listByEventId(event.id)
      expect(details).toHaveLength(2)
      for (const d of details) {
        expect(d.status).toBe('queued')
      }
    })
  })

  describe('getEvent', () => {
    it('returns event by id', () => {
      const created = svc().queueEvent({
        eventType: 'job_created',
        payload: { jobId: 'j1' },
        summary: 'Job created',
      })

      const found = svc().getEvent(created.id)
      expect(found).toBeDefined()
      expect(found!.id).toBe(created.id)
    })

    it('returns undefined for non-existent id', () => {
      expect(svc().getEvent('nonexistent')).toBeUndefined()
    })
  })

  describe('listEvents', () => {
    it('returns events with default pagination', () => {
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'job_deleted', payload: {}, summary: 'b' })

      const events = svc().listEvents()
      expect(events).toHaveLength(2)
    })

    it('respects limit and offset', () => {
      const spy = vi.spyOn(eventRepo(), 'list')
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'job_deleted', payload: {}, summary: 'b' })

      svc().listEvents({ limit: 1, offset: 0 })
      expect(spy).toHaveBeenCalledWith({ limit: 1, offset: 0 })
    })
  })

  describe('deleteEvent', () => {
    it('removes event from store', () => {
      const spy = vi.spyOn(eventRepo(), 'deleteById')
      const event = svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'test' })
      svc().deleteEvent(event.id)

      expect(svc().getEvent(event.id)).toBeUndefined()
      expect(spy).toHaveBeenCalledWith(event.id)
    })

    it('throws NotFoundError for non-existent event', () => {
      expect(() => svc().deleteEvent('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('clearAllEvents', () => {
    it('deletes all events and returns count (admin)', () => {
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'job_deleted', payload: {}, summary: 'b' })

      const count = svc().clearAllEvents(WEBHOOK_ADMIN_USER.id)
      expect(count).toBe(2)
    })

    it('throws ForbiddenError for non-admin user', () => {
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      expect(() => svc().clearAllEvents(WEBHOOK_REGULAR_USER.id)).toThrow(ForbiddenError)
    })
  })

  describe('getQueueStats', () => {
    it('returns total event count', () => {
      svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'part_completed', payload: {}, summary: 'b' })
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'c' })

      const stats = svc().getQueueStats()
      expect(stats.total).toBe(3)
    })

    it('returns zero when queue is empty', () => {
      expect(svc().getQueueStats()).toEqual({ total: 0 })
    })
  })
})
