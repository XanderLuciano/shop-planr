import type { WebhookRegistrationRepository } from '../repositories/interfaces/webhookRegistrationRepository'
import type { WebhookDeliveryRepository } from '../repositories/interfaces/webhookDeliveryRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { WebhookRegistration, WebhookEventType } from '../types/domain'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { ValidationError, NotFoundError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'
import { assertNonEmpty, assertNonEmptyArray } from '../utils/validation'

export interface CreateRegistrationInput {
  name: string
  url: string
  eventTypes: WebhookEventType[]
}

export interface UpdateRegistrationInput {
  name?: string
  url?: string
  eventTypes?: WebhookEventType[]
}

export function createWebhookRegistrationService(repos: {
  webhookRegistrations: WebhookRegistrationRepository
  webhookDeliveries: WebhookDeliveryRepository
  users: UserRepository
  db: { transaction: <T>(fn: () => T) => () => T }
}) {
  function validateEventTypes(eventTypes: WebhookEventType[]): void {
    for (const t of eventTypes) {
      if (!(WEBHOOK_EVENT_TYPES as readonly string[]).includes(t)) {
        throw new ValidationError(`Invalid event type: ${t}`)
      }
    }
  }

  return {
    create(userId: string, input: CreateRegistrationInput): WebhookRegistration {
      requireAdmin(repos.users, userId, 'create webhook registrations')
      assertNonEmpty(input.name, 'name')
      assertNonEmpty(input.url, 'url')
      assertNonEmptyArray(input.eventTypes, 'eventTypes')
      validateEventTypes(input.eventTypes)

      const now = new Date().toISOString()
      const registration: WebhookRegistration = {
        id: generateId('whr'),
        name: input.name.trim(),
        url: input.url.trim(),
        eventTypes: input.eventTypes,
        createdAt: now,
        updatedAt: now,
      }

      return repos.webhookRegistrations.create(registration)
    },

    list(userId: string): WebhookRegistration[] {
      requireAdmin(repos.users, userId, 'list webhook registrations')
      return repos.webhookRegistrations.list()
    },

    getById(id: string): WebhookRegistration {
      const registration = repos.webhookRegistrations.getById(id)
      if (!registration) {
        throw new NotFoundError('WebhookRegistration', id)
      }
      return registration
    },

    update(userId: string, id: string, input: UpdateRegistrationInput): WebhookRegistration {
      requireAdmin(repos.users, userId, 'update webhook registrations')

      const existing = repos.webhookRegistrations.getById(id)
      if (!existing) {
        throw new NotFoundError('WebhookRegistration', id)
      }

      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
      }
      if (input.url !== undefined) {
        assertNonEmpty(input.url, 'url')
      }
      if (input.eventTypes !== undefined) {
        assertNonEmptyArray(input.eventTypes, 'eventTypes')
        validateEventTypes(input.eventTypes)
      }

      const updates: Partial<Pick<WebhookRegistration, 'name' | 'url' | 'eventTypes'>> = {}
      if (input.name !== undefined) updates.name = input.name.trim()
      if (input.url !== undefined) updates.url = input.url.trim()
      if (input.eventTypes !== undefined) updates.eventTypes = input.eventTypes

      return repos.webhookRegistrations.update(id, updates)
    },

    delete(userId: string, id: string): void {
      requireAdmin(repos.users, userId, 'delete webhook registrations')

      const existing = repos.webhookRegistrations.getById(id)
      if (!existing) {
        throw new NotFoundError('WebhookRegistration', id)
      }

      repos.db.transaction(() => {
        repos.webhookDeliveries.cancelQueuedByRegistrationId(id)
        repos.webhookRegistrations.delete(id)
      })()
    },
  }
}

export type WebhookRegistrationService = ReturnType<typeof createWebhookRegistrationService>
