import type { Database } from 'better-sqlite3'
import type { WebhookEventRepository } from '../interfaces/webhookRepository'
import type { WebhookEvent, WebhookEventType, EventWithDeliveries } from '../../types/domain'

// ---- Row shapes ----

interface WebhookEventRow {
  id: string
  event_type: string
  payload: string
  summary: string
  created_at: string
}

interface EventWithSummaryRow {
  id: string
  event_type: string
  payload: string
  summary: string
  created_at: string
  d_queued: number
  d_delivering: number
  d_delivered: number
  d_failed: number
  d_canceled: number
}

// ---- Mapper ----

function rowToEvent(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    eventType: row.event_type as WebhookEventType,
    payload: JSON.parse(row.payload),
    summary: row.summary,
    createdAt: row.created_at,
  }
}

// ---- Event Repository ----

export function createSQLiteWebhookEventRepository(db: Database): WebhookEventRepository {
  return {
    create(event: WebhookEvent): WebhookEvent {
      db.prepare(`
        INSERT INTO webhook_events (id, event_type, payload, summary, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.eventType,
        JSON.stringify(event.payload),
        event.summary,
        event.createdAt,
      )
      return event
    },

    getById(id: string): WebhookEvent | undefined {
      const row = db.prepare('SELECT * FROM webhook_events WHERE id = ?').get(id) as WebhookEventRow | undefined
      return row ? rowToEvent(row) : undefined
    },

    list(options?: { limit?: number, offset?: number }): WebhookEvent[] {
      const limit = options?.limit ?? 200
      const offset = options?.offset ?? 0
      const rows = db.prepare('SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as WebhookEventRow[]
      return rows.map(rowToEvent)
    },

    listWithDeliverySummaries(options?: { limit?: number, offset?: number }): EventWithDeliveries[] {
      const limit = options?.limit ?? 200
      const offset = options?.offset ?? 0
      const rows = db.prepare(`
        SELECT
          e.id,
          e.event_type,
          e.payload,
          e.summary,
          e.created_at,
          COALESCE(SUM(CASE WHEN d.status = 'queued' THEN 1 ELSE 0 END), 0) AS d_queued,
          COALESCE(SUM(CASE WHEN d.status = 'delivering' THEN 1 ELSE 0 END), 0) AS d_delivering,
          COALESCE(SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END), 0) AS d_delivered,
          COALESCE(SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END), 0) AS d_failed,
          COALESCE(SUM(CASE WHEN d.status = 'canceled' THEN 1 ELSE 0 END), 0) AS d_canceled
        FROM webhook_events e
        LEFT JOIN webhook_deliveries d ON d.event_id = e.id
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset) as EventWithSummaryRow[]

      return rows.map((row) => {
        const total = row.d_queued + row.d_delivering + row.d_delivered + row.d_failed + row.d_canceled
        return {
          id: row.id,
          eventType: row.event_type as WebhookEventType,
          payload: JSON.parse(row.payload),
          summary: row.summary,
          createdAt: row.created_at,
          deliverySummary: {
            total,
            queued: row.d_queued,
            delivering: row.d_delivering,
            delivered: row.d_delivered,
            failed: row.d_failed,
            canceled: row.d_canceled,
          },
        }
      })
    },

    count(): number {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM webhook_events').get() as { cnt: number }
      return row.cnt
    },

    deleteById(id: string): void {
      db.prepare('DELETE FROM webhook_events WHERE id = ?').run(id)
    },

    deleteAll(): number {
      const result = db.prepare('DELETE FROM webhook_events').run()
      return result.changes
    },

    purgeOrphaned(): number {
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const result = db.prepare(`
        DELETE FROM webhook_events
        WHERE id NOT IN (SELECT DISTINCT event_id FROM webhook_deliveries)
          AND created_at < ?
      `).run(cutoff)
      return result.changes
    },
  }
}
