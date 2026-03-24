import type Database from 'better-sqlite3'
import type { SnStepStatus } from '../../types/domain'
import type { SnStepStatusRepository } from '../interfaces/snStepStatusRepository'
import { NotFoundError } from '../../utils/errors'

interface SnStepStatusRow {
  id: string
  serial_id: string
  step_id: string
  step_index: number
  status: string
  updated_at: string
}

function rowToDomain(row: SnStepStatusRow): SnStepStatus {
  return {
    id: row.id,
    serialId: row.serial_id,
    stepId: row.step_id,
    stepIndex: row.step_index,
    status: row.status as SnStepStatus['status'],
    updatedAt: row.updated_at,
  }
}

export class SQLiteSnStepStatusRepository implements SnStepStatusRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(status: SnStepStatus): SnStepStatus {
    this.db.prepare(`
      INSERT INTO sn_step_statuses (id, serial_id, step_id, step_index, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(status.id, status.serialId, status.stepId, status.stepIndex, status.status, status.updatedAt)
    return status
  }

  createBatch(statuses: SnStepStatus[]): SnStepStatus[] {
    const insert = this.db.prepare(`
      INSERT INTO sn_step_statuses (id, serial_id, step_id, step_index, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const s of statuses) {
        insert.run(s.id, s.serialId, s.stepId, s.stepIndex, s.status, s.updatedAt)
      }
    })()
    return statuses
  }

  getBySerialAndStep(serialId: string, stepId: string): SnStepStatus | null {
    const row = this.db.prepare(
      'SELECT * FROM sn_step_statuses WHERE serial_id = ? AND step_id = ?'
    ).get(serialId, stepId) as SnStepStatusRow | undefined
    return row ? rowToDomain(row) : null
  }

  listBySerialId(serialId: string): SnStepStatus[] {
    const rows = this.db.prepare(
      'SELECT * FROM sn_step_statuses WHERE serial_id = ? ORDER BY step_index ASC'
    ).all(serialId) as SnStepStatusRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<SnStepStatus>): SnStepStatus {
    const row = this.db.prepare('SELECT * FROM sn_step_statuses WHERE id = ?').get(id) as SnStepStatusRow | undefined
    if (!row) throw new NotFoundError('SnStepStatus', id)

    const existing = rowToDomain(row)
    const updated: SnStepStatus = { ...existing, ...partial, id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE sn_step_statuses SET status = ?, updated_at = ? WHERE id = ?
    `).run(updated.status, updated.updatedAt, id)
    return updated
  }

  updateBySerialAndStep(serialId: string, stepId: string, partial: Partial<SnStepStatus>): SnStepStatus {
    const row = this.db.prepare(
      'SELECT * FROM sn_step_statuses WHERE serial_id = ? AND step_id = ?'
    ).get(serialId, stepId) as SnStepStatusRow | undefined
    if (!row) throw new NotFoundError('SnStepStatus', `${serialId}/${stepId}`)

    const existing = rowToDomain(row)
    const updated: SnStepStatus = { ...existing, ...partial, id: existing.id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE sn_step_statuses SET status = ?, updated_at = ? WHERE serial_id = ? AND step_id = ?
    `).run(updated.status, updated.updatedAt, serialId, stepId)
    return updated
  }
}
