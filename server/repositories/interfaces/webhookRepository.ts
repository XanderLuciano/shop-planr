import type { WebhookEvent, WebhookConfig, WebhookEventStatus } from '../../types/domain'

export interface WebhookEventRepository {
  create(event: WebhookEvent): WebhookEvent
  getById(id: string): WebhookEvent | undefined
  listByStatus(status: WebhookEventStatus, limit?: number): WebhookEvent[]
  list(options?: { limit?: number, offset?: number }): WebhookEvent[]
  updateStatus(id: string, updates: { status: WebhookEventStatus, sentAt?: string, lastError?: string, retryCount?: number }): WebhookEvent
  /** Mark all queued events of a given type as skipped. Returns count affected. */
  skipQueuedByType(eventType: string): number
  deleteById(id: string): void
  deleteAll(): number
  countByStatus(status: WebhookEventStatus): number
}

export interface WebhookConfigRepository {
  get(): WebhookConfig | undefined
  upsert(config: WebhookConfig): WebhookConfig
}
