import type { WebhookDelivery, WebhookDeliveryStatus, QueuedDeliveryView, DeliveryDetail } from '../../types/domain'

export interface WebhookDeliveryRepository {
  create(delivery: WebhookDelivery): WebhookDelivery
  createMany(deliveries: WebhookDelivery[]): void
  getById(id: string): WebhookDelivery | undefined
  getManyByIds(ids: string[]): WebhookDelivery[]
  listQueued(limit?: number): QueuedDeliveryView[]
  listByEventId(eventId: string): DeliveryDetail[]
  updateStatus(id: string, status: WebhookDeliveryStatus, error?: string): WebhookDelivery
  updateManyStatus(ids: string[], status: WebhookDeliveryStatus): void
  incrementAttemptCount(id: string): void
  setNextRetryAt(id: string, nextRetryAt: string): void
  cancelQueuedByRegistrationId(registrationId: string): number
  resetStuckDeliveries(olderThanMinutes: number): number
  purgeOldDeliveries(olderThanDays: number): number
  listFailedByEventId(eventId: string): WebhookDelivery[]
  countByEventId(eventId: string): Record<WebhookDeliveryStatus, number>
  getDeliverySummariesByEventIds(eventIds: string[]): Map<string, Record<WebhookDeliveryStatus, number>>
}
