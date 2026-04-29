import type { WebhookRegistration } from '../../types/domain'

export interface WebhookRegistrationRepository {
  create(registration: WebhookRegistration): WebhookRegistration
  getById(id: string): WebhookRegistration | undefined
  list(): WebhookRegistration[]
  update(id: string, updates: Partial<Pick<WebhookRegistration, 'name' | 'url' | 'eventTypes'>>): WebhookRegistration
  delete(id: string): void
  listByEventType(eventType: string): WebhookRegistration[]
}
