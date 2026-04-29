/**
 * Shared in-memory webhook repositories and service factory for tests.
 *
 * Used by both unit tests (webhookService.test.ts) and property tests
 * (webhookEventLifecycle.property.test.ts) to avoid duplicating the
 * same Map-backed repo logic in two places.
 */
import type { WebhookEventRepository, WebhookConfigRepository } from '~/server/repositories/interfaces/webhookRepository'
import type { UserRepository } from '~/server/repositories/interfaces/userRepository'
import type { WebhookEvent, WebhookConfig, WebhookEventStatus, ShopUser } from '~/server/types/domain'
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
    listByStatus(status: WebhookEventStatus, limit = 100) {
      return [...store.values()]
        .filter(e => e.status === status)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
    },
    list(options?: { limit?: number, offset?: number }) {
      const all = [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const offset = options?.offset ?? 0
      const limit = options?.limit ?? 200
      return all.slice(offset, offset + limit)
    },
    updateStatus(id: string, updates: { status: WebhookEventStatus, sentAt?: string, lastError?: string, retryCount?: number }) {
      const existing = store.get(id)!
      const updated = {
        ...existing,
        status: updates.status,
        sentAt: updates.sentAt ?? existing.sentAt,
        lastError: updates.lastError,
        retryCount: updates.retryCount ?? existing.retryCount,
      }
      store.set(id, updated)
      return updated
    },
    deleteById(id: string) { store.delete(id) },
    skipQueuedByType(eventType: string) {
      let count = 0
      for (const [id, e] of store) {
        if (e.status === 'queued' && e.eventType === eventType) {
          store.set(id, { ...e, status: 'cancelled' })
          count++
        }
      }
      return count
    },
    deleteAll() {
      const c = store.size
      store.clear()
      return c
    },
    countByStatus(status: WebhookEventStatus) {
      return [...store.values()].filter(e => e.status === status).length
    },
  }
}

export function createInMemoryConfigRepo(): WebhookConfigRepository {
  let stored: WebhookConfig | undefined
  return {
    get() { return stored },
    upsert(config: WebhookConfig) {
      stored = config
      return config
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

// ---- Service factory ----

export function createWebhookTestService(users?: ShopUser[]) {
  const eventRepo = createInMemoryEventRepo()
  const configRepo = createInMemoryConfigRepo()
  const userRepo = createInMemoryUserRepo(users ?? [WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])

  const service = createWebhookService({
    webhookEvents: eventRepo,
    webhookConfig: configRepo,
    users: userRepo,
  })

  return { service, eventRepo, configRepo, userRepo }
}
