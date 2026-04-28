import type { Database } from 'better-sqlite3'
import type { WebhookEventRepository, WebhookConfigRepository } from '../interfaces/webhookRepository'
import type { WebhookEvent, WebhookConfig, WebhookEventStatus, WebhookEventType } from '../../types/domain'

// ---- Row shapes ----

interface WebhookEventRow {
  id: string
  event_type: string
  payload: string
  summary: string
  status: string
  created_at: string
  sent_at: string | null
  last_error: string | null
  retry_count: number
}

interface WebhookConfigRow {
  id: string
  endpoint_url: string
  enabled_event_types: string
  is_active: number
  created_at: string
  updated_at: string
}

// ---- Mappers ----

function rowToEvent(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    eventType: row.event_type as WebhookEventType,
    payload: JSON.parse(row.payload),
    summary: row.summary,
    status: row.status as WebhookEventStatus,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
    lastError: row.last_error ?? undefined,
    retryCount: row.retry_count,
  }
}

function rowToConfig(row: WebhookConfigRow): WebhookConfig {
  return {
    id: row.id,
    endpointUrl: row.endpoint_url,
    enabledEventTypes: JSON.parse(row.enabled_event_types),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---- Event Repository ----

export function createSQLiteWebhookEventRepository(db: Database): WebhookEventRepository {
  return {
    create(event: WebhookEvent): WebhookEvent {
      db.prepare(`
        INSERT INTO webhook_events (id, event_type, payload, summary, status, created_at, sent_at, last_error, retry_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.eventType,
        JSON.stringify(event.payload),
        event.summary,
        event.status,
        event.createdAt,
        event.sentAt ?? null,
        event.lastError ?? null,
        event.retryCount,
      )
      return event
    },

    getById(id: string): WebhookEvent | undefined {
      const row = db.prepare('SELECT * FROM webhook_events WHERE id = ?').get(id) as WebhookEventRow | undefined
      return row ? rowToEvent(row) : undefined
    },

    listByStatus(status: WebhookEventStatus, limit = 100): WebhookEvent[] {
      const rows = db.prepare('SELECT * FROM webhook_events WHERE status = ? ORDER BY created_at ASC LIMIT ?').all(status, limit) as WebhookEventRow[]
      return rows.map(rowToEvent)
    },

    list(options?: { limit?: number, offset?: number }): WebhookEvent[] {
      const limit = options?.limit ?? 200
      const offset = options?.offset ?? 0
      const rows = db.prepare('SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as WebhookEventRow[]
      return rows.map(rowToEvent)
    },

    updateStatus(id: string, updates: { status: WebhookEventStatus, sentAt?: string, lastError?: string, retryCount?: number }): WebhookEvent {
      db.prepare(`
        UPDATE webhook_events SET status = ?, sent_at = COALESCE(?, sent_at), last_error = ?, retry_count = COALESCE(?, retry_count)
        WHERE id = ?
      `).run(updates.status, updates.sentAt ?? null, updates.lastError ?? null, updates.retryCount ?? null, id)

      const row = db.prepare('SELECT * FROM webhook_events WHERE id = ?').get(id) as WebhookEventRow
      return rowToEvent(row)
    },

    deleteById(id: string): void {
      db.prepare('DELETE FROM webhook_events WHERE id = ?').run(id)
    },

    deleteAll(): number {
      const result = db.prepare('DELETE FROM webhook_events').run()
      return result.changes
    },

    countByStatus(status: WebhookEventStatus): number {
      const row = db.prepare('SELECT COUNT(*) as count FROM webhook_events WHERE status = ?').get(status) as { count: number }
      return row.count
    },
  }
}

// ---- Config Repository ----

export function createSQLiteWebhookConfigRepository(db: Database): WebhookConfigRepository {
  return {
    get(): WebhookConfig | undefined {
      const row = db.prepare('SELECT * FROM webhook_config WHERE id = ?').get('default') as WebhookConfigRow | undefined
      return row ? rowToConfig(row) : undefined
    },

    upsert(config: WebhookConfig): WebhookConfig {
      db.prepare(`
        INSERT INTO webhook_config (id, endpoint_url, enabled_event_types, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          endpoint_url = excluded.endpoint_url,
          enabled_event_types = excluded.enabled_event_types,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `).run(
        config.id,
        config.endpointUrl,
        JSON.stringify(config.enabledEventTypes),
        config.isActive ? 1 : 0,
        config.createdAt,
        config.updatedAt,
      )
      return config
    },
  }
}
