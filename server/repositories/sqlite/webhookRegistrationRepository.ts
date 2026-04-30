import type { Database } from 'better-sqlite3'
import type { WebhookRegistrationRepository } from '../interfaces/webhookRegistrationRepository'
import type { WebhookRegistration } from '../../types/domain'

// ---- Row shape ----

interface WebhookRegistrationRow {
  id: string
  name: string
  url: string
  event_types: string
  created_at: string
  updated_at: string
}

// ---- Mapper ----

function rowToRegistration(row: WebhookRegistrationRow): WebhookRegistration {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    eventTypes: JSON.parse(row.event_types),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---- Repository ----

export function createSQLiteWebhookRegistrationRepository(db: Database): WebhookRegistrationRepository {
  return {
    create(registration: WebhookRegistration): WebhookRegistration {
      db.prepare(`
        INSERT INTO webhook_registrations (id, name, url, event_types, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        registration.id,
        registration.name,
        registration.url,
        JSON.stringify(registration.eventTypes),
        registration.createdAt,
        registration.updatedAt,
      )
      return registration
    },

    getById(id: string): WebhookRegistration | undefined {
      const row = db.prepare('SELECT * FROM webhook_registrations WHERE id = ?').get(id) as WebhookRegistrationRow | undefined
      return row ? rowToRegistration(row) : undefined
    },

    list(): WebhookRegistration[] {
      const rows = db.prepare('SELECT * FROM webhook_registrations ORDER BY created_at DESC').all() as WebhookRegistrationRow[]
      return rows.map(rowToRegistration)
    },

    update(id: string, updates: Partial<Pick<WebhookRegistration, 'name' | 'url' | 'eventTypes'>>): WebhookRegistration {
      const setClauses: string[] = []
      const params: unknown[] = []

      if (updates.name !== undefined) {
        setClauses.push('name = ?')
        params.push(updates.name)
      }
      if (updates.url !== undefined) {
        setClauses.push('url = ?')
        params.push(updates.url)
      }
      if (updates.eventTypes !== undefined) {
        setClauses.push('event_types = ?')
        params.push(JSON.stringify(updates.eventTypes))
      }

      if (setClauses.length > 0) {
        setClauses.push('updated_at = ?')
        params.push(new Date().toISOString())
        params.push(id)

        db.prepare(`UPDATE webhook_registrations SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
      }

      const row = db.prepare('SELECT * FROM webhook_registrations WHERE id = ?').get(id) as WebhookRegistrationRow
      return rowToRegistration(row)
    },

    delete(id: string): void {
      db.prepare('DELETE FROM webhook_registrations WHERE id = ?').run(id)
    },

    listByEventType(eventType: string): WebhookRegistration[] {
      const rows = db.prepare(`
        SELECT wr.* FROM webhook_registrations wr, json_each(wr.event_types) je
        WHERE je.value = ?
      `).all(eventType) as WebhookRegistrationRow[]
      return rows.map(rowToRegistration)
    },
  }
}
