import type { Database } from 'better-sqlite3'
import type { WebhookEventRepository } from '../interfaces/webhookRepository'
import type { WebhookEvent, WebhookEventType } from '../../types/domain'

// ---- Row shape ----

interface WebhookEventRow {
  id: string
  event_type: string
  payload: string
  summary: string
  created_at: string
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

    deleteById(id: string): void {
      db.prepare('DELETE FROM webhook_events WHERE id = ?').run(id)
    },

    deleteAll(): number {
      const result = db.prepare('DELETE FROM webhook_events').run()
      return result.changes
    },
  }
}
