import type { Database } from 'better-sqlite3'
import type { WebhookDeliveryRepository } from '../interfaces/webhookDeliveryRepository'
import type { WebhookDelivery, WebhookDeliveryStatus, QueuedDeliveryView, DeliveryDetail, WebhookEventType } from '../../types/domain'

// ---- Row shapes ----

interface WebhookDeliveryRow {
  id: string
  event_id: string
  registration_id: string
  status: string
  error: string | null
  attempt_count: number
  next_retry_at: string | null
  created_at: string
  updated_at: string
}

interface QueuedDeliveryViewRow {
  id: string
  event_id: string
  registration_id: string
  registration_name: string
  registration_url: string
  event_type: string
  payload: string
  summary: string
  event_created_at: string
}

interface DeliveryDetailRow {
  id: string
  registration_id: string
  registration_name: string
  registration_url: string
  status: string
  error: string | null
  attempt_count: number
  next_retry_at: string | null
  created_at: string
  updated_at: string
}

interface StatusCountRow {
  event_id: string
  status: string
  count: number
}

// ---- Mappers ----

function rowToDelivery(row: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    eventId: row.event_id,
    registrationId: row.registration_id,
    status: row.status as WebhookDeliveryStatus,
    error: row.error ?? undefined,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToQueuedView(row: QueuedDeliveryViewRow): QueuedDeliveryView {
  return {
    id: row.id,
    eventId: row.event_id,
    registrationId: row.registration_id,
    registrationName: row.registration_name,
    registrationUrl: row.registration_url,
    eventType: row.event_type as WebhookEventType,
    payload: JSON.parse(row.payload),
    summary: row.summary,
    eventCreatedAt: row.event_created_at,
  }
}

function rowToDeliveryDetail(row: DeliveryDetailRow): DeliveryDetail {
  return {
    id: row.id,
    registrationId: row.registration_id,
    registrationName: row.registration_name,
    registrationUrl: row.registration_url,
    status: row.status as WebhookDeliveryStatus,
    error: row.error ?? undefined,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function emptyStatusCounts(): Record<WebhookDeliveryStatus, number> {
  return { queued: 0, delivering: 0, delivered: 0, failed: 0, canceled: 0 }
}

// ---- Repository ----

export function createSQLiteWebhookDeliveryRepository(db: Database): WebhookDeliveryRepository {
  return {
    create(delivery: WebhookDelivery): WebhookDelivery {
      db.prepare(`
        INSERT INTO webhook_deliveries (id, event_id, registration_id, status, error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        delivery.id,
        delivery.eventId,
        delivery.registrationId,
        delivery.status,
        delivery.error ?? null,
        delivery.createdAt,
        delivery.updatedAt,
      )
      return delivery
    },

    createMany(deliveries: WebhookDelivery[]): void {
      const stmt = db.prepare(`
        INSERT INTO webhook_deliveries (id, event_id, registration_id, status, error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const insertMany = db.transaction((items: WebhookDelivery[]) => {
        for (const d of items) {
          stmt.run(d.id, d.eventId, d.registrationId, d.status, d.error ?? null, d.createdAt, d.updatedAt)
        }
      })
      insertMany(deliveries)
    },

    getById(id: string): WebhookDelivery | undefined {
      const row = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id) as WebhookDeliveryRow | undefined
      return row ? rowToDelivery(row) : undefined
    },

    getManyByIds(ids: string[]): WebhookDelivery[] {
      if (ids.length === 0) return []
      const placeholders = ids.map(() => '?').join(', ')
      const rows = db.prepare(`SELECT * FROM webhook_deliveries WHERE id IN (${placeholders})`).all(...ids) as WebhookDeliveryRow[]
      return rows.map(rowToDelivery)
    },

    listQueued(limit = 100): QueuedDeliveryView[] {
      const now = new Date().toISOString()
      const rows = db.prepare(`
        SELECT
          d.id,
          d.event_id,
          d.registration_id,
          r.name AS registration_name,
          r.url AS registration_url,
          e.event_type,
          e.payload,
          e.summary,
          e.created_at AS event_created_at
        FROM webhook_deliveries d
        JOIN webhook_registrations r ON r.id = d.registration_id
        JOIN webhook_events e ON e.id = d.event_id
        WHERE d.status = 'queued'
          AND (d.next_retry_at IS NULL OR d.next_retry_at <= ?)
        ORDER BY d.created_at ASC
        LIMIT ?
      `).all(now, limit) as QueuedDeliveryViewRow[]
      return rows.map(rowToQueuedView)
    },

    listByEventId(eventId: string): DeliveryDetail[] {
      const rows = db.prepare(`
        SELECT
          d.id,
          d.registration_id,
          r.name AS registration_name,
          r.url AS registration_url,
          d.status,
          d.error,
          d.attempt_count,
          d.next_retry_at,
          d.created_at,
          d.updated_at
        FROM webhook_deliveries d
        JOIN webhook_registrations r ON r.id = d.registration_id
        WHERE d.event_id = ?
        ORDER BY d.created_at ASC
      `).all(eventId) as DeliveryDetailRow[]
      return rows.map(rowToDeliveryDetail)
    },

    updateStatus(id: string, status: WebhookDeliveryStatus, error?: string): WebhookDelivery {
      const now = new Date().toISOString()
      db.prepare(`
        UPDATE webhook_deliveries SET status = ?, error = ?, updated_at = ? WHERE id = ?
      `).run(status, error ?? null, now, id)

      const row = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id) as WebhookDeliveryRow
      return rowToDelivery(row)
    },

    updateManyStatus(ids: string[], status: WebhookDeliveryStatus): void {
      if (ids.length === 0) return
      const now = new Date().toISOString()
      const placeholders = ids.map(() => '?').join(', ')
      db.prepare(`
        UPDATE webhook_deliveries SET status = ?, updated_at = ? WHERE id IN (${placeholders})
      `).run(status, now, ...ids)
    },

    cancelQueuedByRegistrationId(registrationId: string): number {
      const now = new Date().toISOString()
      const result = db.prepare(`
        UPDATE webhook_deliveries SET status = 'canceled', updated_at = ?
        WHERE registration_id = ? AND status = 'queued'
      `).run(now, registrationId)
      return result.changes
    },

    resetStuckDeliveries(olderThanMinutes: number): number {
      const now = new Date().toISOString()
      const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString()
      const result = db.prepare(`
        UPDATE webhook_deliveries SET status = 'queued', updated_at = ?
        WHERE status = 'delivering' AND updated_at < ?
      `).run(now, cutoff)
      return result.changes
    },

    incrementAttemptCount(id: string): void {
      const now = new Date().toISOString()
      db.prepare(`
        UPDATE webhook_deliveries SET attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?
      `).run(now, id)
    },

    setNextRetryAt(id: string, nextRetryAt: string): void {
      const now = new Date().toISOString()
      db.prepare(`
        UPDATE webhook_deliveries SET next_retry_at = ?, updated_at = ? WHERE id = ?
      `).run(nextRetryAt || null, now, id)
    },

    purgeOldDeliveries(olderThanDays: number): number {
      const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString()
      const result = db.prepare(`
        DELETE FROM webhook_deliveries
        WHERE status IN ('delivered', 'canceled') AND updated_at < ?
      `).run(cutoff)
      return result.changes
    },

    listFailedByEventId(eventId: string): WebhookDelivery[] {
      const rows = db.prepare(`
        SELECT * FROM webhook_deliveries WHERE event_id = ? AND status = 'failed' ORDER BY created_at ASC
      `).all(eventId) as WebhookDeliveryRow[]
      return rows.map(rowToDelivery)
    },

    countByEventId(eventId: string): Record<WebhookDeliveryStatus, number> {
      const rows = db.prepare(`
        SELECT status, COUNT(*) as count FROM webhook_deliveries WHERE event_id = ? GROUP BY status
      `).all(eventId) as StatusCountRow[]

      const counts = emptyStatusCounts()
      for (const row of rows) {
        counts[row.status as WebhookDeliveryStatus] = row.count
      }
      return counts
    },

    getDeliverySummariesByEventIds(eventIds: string[]): Map<string, Record<WebhookDeliveryStatus, number>> {
      const result = new Map<string, Record<WebhookDeliveryStatus, number>>()
      if (eventIds.length === 0) return result

      // Initialize all event IDs with empty counts
      for (const id of eventIds) {
        result.set(id, emptyStatusCounts())
      }

      const placeholders = eventIds.map(() => '?').join(', ')
      const rows = db.prepare(`
        SELECT event_id, status, COUNT(*) as count
        FROM webhook_deliveries
        WHERE event_id IN (${placeholders})
        GROUP BY event_id, status
      `).all(...eventIds) as StatusCountRow[]

      for (const row of rows) {
        const counts = result.get(row.event_id)
        if (counts) {
          counts[row.status as WebhookDeliveryStatus] = row.count
        }
      }

      return result
    },
  }
}
