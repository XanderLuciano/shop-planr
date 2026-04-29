import type { WebhookEvent } from '../../types/domain'

export interface WebhookEventRepository {
  create(event: WebhookEvent): WebhookEvent
  getById(id: string): WebhookEvent | undefined
  list(options?: { limit?: number, offset?: number }): WebhookEvent[]
  count(): number
  deleteById(id: string): void
  deleteAll(): number
  purgeOrphaned(): number
}
