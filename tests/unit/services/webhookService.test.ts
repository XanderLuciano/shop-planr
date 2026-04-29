/**
 * Unit tests for webhookService.
 *
 * Covers: event CRUD, status transitions, retry logic, config management,
 * validation of event types, queue stats (including cancelled), admin gating,
 * enabledSince tracking, and skipQueuedByType on type disable.
 *
 * Uses shared in-memory repos from webhookTestHarness. Where spy assertions
 * are needed (e.g. verifying repo method was called), the test wraps the
 * repo method with vi.fn().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError } from '~/server/utils/errors'
import {
  createWebhookTestService,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from '../../properties/helpers/webhookTestHarness'

type TestHarness = ReturnType<typeof createWebhookTestService>

describe('WebhookService', () => {
  let harness: TestHarness

  beforeEach(() => {
    harness = createWebhookTestService()
  })

  // Shorthand accessors
  const svc = () => harness.service
  const eventRepo = () => harness.eventRepo

  // ---- Event CRUD ----

  describe('queueEvent', () => {
    it('creates a queued event with correct fields', () => {
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
      expect(event.status).toBe('queued')
      expect(event.retryCount).toBe(0)
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

  describe('listQueuedEvents', () => {
    it('returns only queued events', () => {
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      const e2 = svc().queueEvent({ eventType: 'job_deleted', payload: {}, summary: 'b' })
      svc().markSent(e2.id)

      const queued = svc().listQueuedEvents()
      expect(queued).toHaveLength(1)
      expect(queued[0].status).toBe('queued')
    })
  })

  describe('listFailedEvents', () => {
    it('returns only failed events', () => {
      const e1 = svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'job_deleted', payload: {}, summary: 'b' })
      svc().markFailed(e1.id, 'timeout')

      const failed = svc().listFailedEvents()
      expect(failed).toHaveLength(1)
      expect(failed[0].status).toBe('failed')
    })
  })

  // ---- Status transitions ----

  describe('markSent', () => {
    it('transitions event to sent status with sentAt timestamp', () => {
      const event = svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'test' })
      const sent = svc().markSent(event.id)

      expect(sent.status).toBe('sent')
      expect(sent.sentAt).toBeTruthy()
      expect(sent.lastError).toBeUndefined()
    })

    it('throws NotFoundError for non-existent event', () => {
      expect(() => svc().markSent('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('markFailed', () => {
    it('transitions event to failed status with error and incremented retryCount', () => {
      const event = svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'test' })
      const failed = svc().markFailed(event.id, 'Connection refused')

      expect(failed.status).toBe('failed')
      expect(failed.lastError).toBe('Connection refused')
      expect(failed.retryCount).toBe(1)
    })

    it('increments retryCount on repeated failures', () => {
      const event = svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'test' })
      svc().markFailed(event.id, 'error 1')
      const failed2 = svc().markFailed(event.id, 'error 2')

      expect(failed2.retryCount).toBe(2)
      expect(failed2.lastError).toBe('error 2')
    })

    it('throws NotFoundError for non-existent event', () => {
      expect(() => svc().markFailed('nonexistent', 'err')).toThrow(NotFoundError)
    })
  })

  describe('requeueEvent', () => {
    it('transitions failed event back to queued', () => {
      const event = svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'test' })
      svc().markFailed(event.id, 'error')
      const requeued = svc().requeueEvent(event.id)

      expect(requeued.status).toBe('queued')
      expect(requeued.lastError).toBeUndefined()
    })

    it('throws NotFoundError for non-existent event', () => {
      expect(() => svc().requeueEvent('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('requeueAllFailed', () => {
    it('requeues all failed events and returns count (admin)', () => {
      const e1 = svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'a' })
      const e2 = svc().queueEvent({ eventType: 'part_completed', payload: {}, summary: 'b' })
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'c' })

      svc().markFailed(e1.id, 'err1')
      svc().markFailed(e2.id, 'err2')

      const count = svc().requeueAllFailed(WEBHOOK_ADMIN_USER.id)
      expect(count).toBe(2)

      const queued = svc().listQueuedEvents()
      expect(queued).toHaveLength(3)
    })

    it('returns 0 when no failed events exist (admin)', () => {
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'a' })
      expect(svc().requeueAllFailed(WEBHOOK_ADMIN_USER.id)).toBe(0)
    })

    it('throws ForbiddenError for non-admin user', () => {
      expect(() => svc().requeueAllFailed(WEBHOOK_REGULAR_USER.id)).toThrow(ForbiddenError)
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

  // ---- Queue stats ----

  describe('getQueueStats', () => {
    it('returns counts by status including cancelled', () => {
      const e1 = svc().queueEvent({ eventType: 'part_created', payload: {}, summary: 'a' })
      const e2 = svc().queueEvent({ eventType: 'part_completed', payload: {}, summary: 'b' })
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'c' })

      svc().markSent(e1.id)
      svc().markFailed(e2.id, 'err')

      const stats = svc().getQueueStats()
      expect(stats).toEqual({ queued: 1, sent: 1, failed: 1, cancelled: 0 })
    })

    it('returns all zeros when queue is empty', () => {
      expect(svc().getQueueStats()).toEqual({ queued: 0, sent: 0, failed: 0, cancelled: 0 })
    })

    it('counts cancelled events after type is disabled', () => {
      svc().queueEvent({ eventType: 'part_advanced', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'b' })

      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['part_advanced', 'job_created'] })
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['job_created'] })

      expect(svc().getQueueStats()).toEqual({ queued: 1, sent: 0, failed: 0, cancelled: 1 })
    })
  })

  // ---- Config ----

  describe('getConfig', () => {
    it('returns defaults when no config exists', () => {
      const config = svc().getConfig()

      expect(config.id).toBe('default')
      expect(config.endpointUrl).toBe('')
      expect(config.enabledEventTypes).toEqual([])
      expect(config.enabledSince).toEqual({})
      expect(config.isActive).toBe(false)
    })

    it('returns stored config when it exists', () => {
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, {
        endpointUrl: 'https://example.com/webhook',
        enabledEventTypes: ['part_advanced', 'job_created'],
        isActive: true,
      })

      const config = svc().getConfig()
      expect(config.endpointUrl).toBe('https://example.com/webhook')
      expect(config.enabledEventTypes).toEqual(['part_advanced', 'job_created'])
      expect(config.isActive).toBe(true)
    })
  })

  describe('updateConfig', () => {
    it('merges partial update with current config (admin)', () => {
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { endpointUrl: 'https://example.com/hook' })
      const config = svc().getConfig()

      expect(config.endpointUrl).toBe('https://example.com/hook')
      expect(config.isActive).toBe(false)
      expect(config.enabledEventTypes).toEqual([])
    })

    it('updates enabledEventTypes (admin)', () => {
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['part_advanced', 'part_completed'] })
      expect(svc().getConfig().enabledEventTypes).toEqual(['part_advanced', 'part_completed'])
    })

    it('updates isActive flag (admin)', () => {
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { isActive: true })
      expect(svc().getConfig().isActive).toBe(true)
    })

    it('rejects invalid event types in enabledEventTypes', () => {
      expect(() => svc().updateConfig(WEBHOOK_ADMIN_USER.id, {
        enabledEventTypes: ['part_advanced', 'bogus_type' as any],
      })).toThrow(ValidationError)
    })

    it('sets updatedAt timestamp', () => {
      const config = svc().updateConfig(WEBHOOK_ADMIN_USER.id, { endpointUrl: 'https://test.com' })
      expect(config.updatedAt).toBeTruthy()
    })

    it('preserves existing config on subsequent updates', () => {
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { endpointUrl: 'https://first.com', isActive: true })
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['job_created'] })

      const config = svc().getConfig()
      expect(config.endpointUrl).toBe('https://first.com')
      expect(config.isActive).toBe(true)
      expect(config.enabledEventTypes).toEqual(['job_created'])
    })

    it('throws ForbiddenError for non-admin user', () => {
      expect(() => svc().updateConfig(WEBHOOK_REGULAR_USER.id, { isActive: true })).toThrow(ForbiddenError)
    })

    it('tracks enabledSince timestamps for newly enabled types', () => {
      const before = new Date().toISOString()
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['part_advanced', 'job_created'] })
      const config = svc().getConfig()

      expect(config.enabledSince.part_advanced).toBeTruthy()
      expect(config.enabledSince.job_created).toBeTruthy()
      expect(config.enabledSince.part_advanced! >= before).toBe(true)
    })

    it('preserves enabledSince for types that remain enabled', () => {
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['part_advanced', 'job_created'] })
      const originalTimestamp = svc().getConfig().enabledSince.part_advanced

      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['part_advanced', 'part_completed'] })
      const config = svc().getConfig()

      expect(config.enabledSince.part_advanced).toBe(originalTimestamp)
      expect(config.enabledSince.part_completed).toBeTruthy()
      expect(config.enabledSince.job_created).toBeUndefined()
    })

    it('cancels queued events when their type is disabled', () => {
      svc().queueEvent({ eventType: 'part_advanced', payload: {}, summary: 'a' })
      svc().queueEvent({ eventType: 'part_advanced', payload: {}, summary: 'b' })
      svc().queueEvent({ eventType: 'job_created', payload: {}, summary: 'c' })

      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['part_advanced', 'job_created'] })
      svc().updateConfig(WEBHOOK_ADMIN_USER.id, { enabledEventTypes: ['job_created'] })

      const stats = svc().getQueueStats()
      expect(stats.cancelled).toBe(2)
      expect(stats.queued).toBe(1)
    })
  })
})
