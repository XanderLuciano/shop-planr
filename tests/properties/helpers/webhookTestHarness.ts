/**
 * Shared in-memory webhook repositories and service factory for tests.
 *
 * Used by both unit tests (webhookService.test.ts) and property tests
 * (webhookEventLifecycle.property.test.ts) to avoid duplicating the
 * same Map-backed repo logic in two places.
 */
import type { WebhookEventRepository } from '~/server/repositories/interfaces/webhookRepository'
import type { WebhookRegistrationRepository } from '~/server/repositories/interfaces/webhookRegistrationRepository'
import type { WebhookDeliveryRepository } from '~/server/repositories/interfaces/webhookDeliveryRepository'
import type { UserRepository } from '~/server/repositories/interfaces/userRepository'
import type { WebhookEvent, WebhookRegistration, WebhookDelivery, WebhookDeliveryStatus, QueuedDeliveryView, DeliveryDetail, ShopUser } from '~/server/types/domain'
import { createWebhookService } from '~/server/services/webhookService'

// ---- Shared admin fixture ----

export const WEBHOOK_ADMIN_USER: ShopUser = {
  id: 'admin-wh',
  username: 'admin',
  displayName: 'Admin',
  isAdmin: true,
  active: true,
  pinHash: null,
  createdAt: '2024-01-01T00:00:00.000Z',
}

export const WEBHOOK_REGULAR_USER: ShopUser = {
  id: 'user-wh',
  username: 'operator',
  displayName: 'Operator',
  isAdmin: false,
  active: true,
  pinHash: null,
  createdAt: '2024-01-01T00:00:00.000Z',
}

// ---- In-memory repos ----

export function createInMemoryEventRepo(): WebhookEventRepository {
  const store = new Map<string, WebhookEvent>()
  return {
    create(event: WebhookEvent) {
      store.set(event.id, event)
      return event
    },
    getById(id: string) { return store.get(id) },
    list(options?: { limit?: number, offset?: number }) {
      const all = [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const offset = options?.offset ?? 0
      const limit = options?.limit ?? 200
      return all.slice(offset, offset + limit)
    },
    count() { return store.size },
    deleteById(id: string) { store.delete(id) },
    deleteAll() {
      const c = store.size
      store.clear()
      return c
    },
    purgeOrphaned() { return 0 },
  }
}

export function createInMemoryRegistrationRepo(): WebhookRegistrationRepository {
  const store = new Map<string, WebhookRegistration>()
  return {
    create(registration: WebhookRegistration) {
      store.set(registration.id, registration)
      return registration
    },
    getById(id: string) { return store.get(id) },
    list() {
      return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    update(id: string, updates: Partial<Pick<WebhookRegistration, 'name' | 'url' | 'eventTypes'>>) {
      const existing = store.get(id)!
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      store.set(id, updated)
      return updated
    },
    delete(id: string) { store.delete(id) },
    listByEventType(eventType: string) {
      return [...store.values()].filter(r => r.eventTypes.includes(eventType))
    },
  }
}

export function createInMemoryDeliveryRepo(): WebhookDeliveryRepository {
  const store = new Map<string, WebhookDelivery>()
  return {
    create(delivery: WebhookDelivery) {
      store.set(delivery.id, delivery)
      return delivery
    },
    createMany(deliveries: WebhookDelivery[]) {
      for (const d of deliveries) {
        store.set(d.id, d)
      }
    },
    getById(id: string) { return store.get(id) },
    getManyByIds(ids: string[]) {
      return ids.map(id => store.get(id)).filter((d): d is WebhookDelivery => d !== undefined)
    },
    listQueued(_limit = 100): QueuedDeliveryView[] {
      // Simplified — real implementation joins with registrations and events
      return []
    },
    listByEventId(eventId: string): DeliveryDetail[] {
      return [...store.values()]
        .filter(d => d.eventId === eventId)
        .map(d => ({
          id: d.id,
          registrationId: d.registrationId,
          registrationName: '',
          registrationUrl: '',
          status: d.status,
          error: d.error,
          attemptCount: d.attemptCount,
          nextRetryAt: d.nextRetryAt,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }))
    },
    updateStatus(id: string, status: WebhookDeliveryStatus, error?: string) {
      const existing = store.get(id)!
      const updated = { ...existing, status, error, updatedAt: new Date().toISOString() }
      store.set(id, updated)
      return updated
    },
    updateManyStatus(ids: string[], status: WebhookDeliveryStatus) {
      const now = new Date().toISOString()
      for (const id of ids) {
        const existing = store.get(id)
        if (existing) {
          store.set(id, { ...existing, status, updatedAt: now })
        }
      }
    },
    cancelQueuedByRegistrationId(registrationId: string) {
      let count = 0
      const now = new Date().toISOString()
      for (const [id, d] of store) {
        if (d.registrationId === registrationId && d.status === 'queued') {
          store.set(id, { ...d, status: 'canceled', updatedAt: now })
          count++
        }
      }
      return count
    },
    resetStuckDeliveries(olderThanMinutes: number) {
      let count = 0
      const now = new Date().toISOString()
      const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString()
      for (const [id, d] of store) {
        if (d.status === 'delivering' && d.updatedAt < cutoff) {
          store.set(id, { ...d, status: 'queued', updatedAt: now })
          count++
        }
      }
      return count
    },
    incrementAttemptCount(id: string) {
      const existing = store.get(id)
      if (existing) {
        const newCount = existing.attemptCount + 1
        store.set(id, { ...existing, attemptCount: newCount, updatedAt: new Date().toISOString() })
        return newCount
      }
      return 0
    },
    setNextRetryAt(id: string, nextRetryAt: string) {
      const existing = store.get(id)
      if (existing) {
        store.set(id, { ...existing, nextRetryAt: nextRetryAt || undefined, updatedAt: new Date().toISOString() })
      }
    },
    purgeOldDeliveries(_olderThanDays: number) {
      return 0
    },
    listFailedByEventId(eventId: string) {
      return [...store.values()].filter(d => d.eventId === eventId && d.status === 'failed')
    },
    countByEventId(eventId: string) {
      const counts: Record<WebhookDeliveryStatus, number> = { queued: 0, delivering: 0, delivered: 0, failed: 0, canceled: 0 }
      for (const d of store.values()) {
        if (d.eventId === eventId) {
          counts[d.status]++
        }
      }
      return counts
    },
    getDeliverySummariesByEventIds(eventIds: string[]) {
      const result = new Map<string, Record<WebhookDeliveryStatus, number>>()
      for (const eid of eventIds) {
        result.set(eid, { queued: 0, delivering: 0, delivered: 0, failed: 0, canceled: 0 })
      }
      for (const d of store.values()) {
        const counts = result.get(d.eventId)
        if (counts) {
          counts[d.status]++
        }
      }
      return result
    },
  }
}

export function createInMemoryUserRepo(users: ShopUser[] = [WEBHOOK_ADMIN_USER]): UserRepository {
  const store = new Map(users.map(u => [u.id, u]))
  return {
    create: () => users[0],
    getById: (id: string) => store.get(id),
    getByUsername: () => undefined,
    list: () => [...store.values()],
    update: () => users[0],
  } as unknown as UserRepository
}

// ---- Passthrough transaction shim for in-memory repos ----

export const passthroughDb = {
  transaction: <T>(fn: () => T) => fn,
}

// ---- Service factory ----

export function createWebhookTestService(users?: ShopUser[]) {
  const eventRepo = createInMemoryEventRepo()
  const registrationRepo = createInMemoryRegistrationRepo()
  const deliveryRepo = createInMemoryDeliveryRepo()
  const userRepo = createInMemoryUserRepo(users ?? [WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

  const service = createWebhookService({
    webhookEvents: eventRepo,
    webhookRegistrations: registrationRepo,
    webhookDeliveries: deliveryRepo,
    users: userRepo,
    db: passthroughDb,
  })

  return { service, eventRepo, registrationRepo, deliveryRepo, userRepo, db: passthroughDb }
}
