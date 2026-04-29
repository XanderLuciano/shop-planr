import type { WebhookDelivery, WebhookDeliveryStatus, QueuedDeliveryView, DeliveryDetail } from '../../types/domain'

export interface WebhookDeliveryRepository {
  create(delivery: WebhookDelivery): WebhookDelivery
  createMany(deliveries: WebhookDelivery[]): void
  getById(id: string): WebhookDelivery | undefined
  listQueued(limit?: number): QueuedDeliveryView[]
  listByEventId(eventId: string): DeliveryDetail[]
  updateStatus(id: string, status: WebhookDeliveryStatus, error?: string): WebhookDelivery
  updateManyStatus(ids: string[], status: WebhookDeliveryStatus): void
  cancelQueuedByRegistrationId(registrationId: string): number
  listFailedByEventId(eventId: string): WebhookDelivery[]
  countByEventId(eventId: string): Record<WebhookDeliveryStatus, number>
  getDeliverySummariesByEventIds(eventIds: string[]): Map<string, Record<WebhookDeliveryStatus, number>>
}
