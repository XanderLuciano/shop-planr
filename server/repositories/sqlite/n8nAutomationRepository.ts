import type { Database } from 'better-sqlite3'
import type { N8nAutomationRepository } from '../interfaces/n8nAutomationRepository'
import type { N8nAutomation } from '../../types/domain'

// ---- Row shape ----

interface N8nAutomationRow {
  id: string
  name: string
  description: string
  event_types: string
  workflow_json: string
  enabled: number
  n8n_workflow_id: string | null
  linked_registration_id: string | null
  created_at: string
  updated_at: string
}

// ---- Mapper ----

function rowToAutomation(row: N8nAutomationRow): N8nAutomation {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    eventTypes: JSON.parse(row.event_types),
    workflowJson: JSON.parse(row.workflow_json),
    enabled: row.enabled === 1,
    n8nWorkflowId: row.n8n_workflow_id,
    linkedRegistrationId: row.linked_registration_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---- Repository ----

export function createSQLiteN8nAutomationRepository(db: Database): N8nAutomationRepository {
  return {
    create(automation: N8nAutomation): N8nAutomation {
      db.prepare(`
        INSERT INTO n8n_automations (id, name, description, event_types, workflow_json, enabled, n8n_workflow_id, linked_registration_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        automation.id,
        automation.name,
        automation.description,
        JSON.stringify(automation.eventTypes),
        JSON.stringify(automation.workflowJson),
        automation.enabled ? 1 : 0,
        automation.n8nWorkflowId,
        automation.linkedRegistrationId,
        automation.createdAt,
        automation.updatedAt,
      )
      return automation
    },

    getById(id: string): N8nAutomation | undefined {
      const row = db.prepare('SELECT * FROM n8n_automations WHERE id = ?').get(id) as N8nAutomationRow | undefined
      return row ? rowToAutomation(row) : undefined
    },

    list(): N8nAutomation[] {
      const rows = db.prepare('SELECT * FROM n8n_automations ORDER BY created_at DESC').all() as N8nAutomationRow[]
      return rows.map(rowToAutomation)
    },

    update(id: string, updates: Partial<Pick<N8nAutomation, 'name' | 'description' | 'eventTypes' | 'workflowJson' | 'enabled' | 'n8nWorkflowId' | 'linkedRegistrationId'>>): N8nAutomation {
      const setClauses: string[] = []
      const params: unknown[] = []

      if (updates.name !== undefined) {
        setClauses.push('name = ?')
        params.push(updates.name)
      }
      if (updates.description !== undefined) {
        setClauses.push('description = ?')
        params.push(updates.description)
      }
      if (updates.eventTypes !== undefined) {
        setClauses.push('event_types = ?')
        params.push(JSON.stringify(updates.eventTypes))
      }
      if (updates.workflowJson !== undefined) {
        setClauses.push('workflow_json = ?')
        params.push(JSON.stringify(updates.workflowJson))
      }
      if (updates.enabled !== undefined) {
        setClauses.push('enabled = ?')
        params.push(updates.enabled ? 1 : 0)
      }
      if (updates.n8nWorkflowId !== undefined) {
        setClauses.push('n8n_workflow_id = ?')
        params.push(updates.n8nWorkflowId)
      }
      if (updates.linkedRegistrationId !== undefined) {
        setClauses.push('linked_registration_id = ?')
        params.push(updates.linkedRegistrationId)
      }

      if (setClauses.length > 0) {
        setClauses.push('updated_at = ?')
        params.push(new Date().toISOString())
        params.push(id)

        db.prepare(`UPDATE n8n_automations SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
      }

      const row = db.prepare('SELECT * FROM n8n_automations WHERE id = ?').get(id) as N8nAutomationRow
      return rowToAutomation(row)
    },

    delete(id: string): void {
      db.prepare('DELETE FROM n8n_automations WHERE id = ?').run(id)
    },

    listByEventType(eventType: string): N8nAutomation[] {
      const rows = db.prepare(`
        SELECT a.* FROM n8n_automations a, json_each(a.event_types) je
        WHERE je.value = ? AND a.enabled = 1
      `).all(eventType) as N8nAutomationRow[]
      return rows.map(rowToAutomation)
    },

    listEnabled(): N8nAutomation[] {
      const rows = db.prepare('SELECT * FROM n8n_automations WHERE enabled = 1 ORDER BY created_at DESC').all() as N8nAutomationRow[]
      return rows.map(rowToAutomation)
    },
  }
}
