import type Database from 'better-sqlite3'
import type { PartStepStatus } from '../../types/domain'
import type { PartStepStatusRepository } from '../interfaces/partStepStatusRepository'
import { NotFoundError } from '../../utils/errors'

interface PartStepStatusRow {
  id: string
  part_id: string
  step_id: string
  step_index: number
  status: string
  updated_at: string
}

function rowToDomain(row: PartStepStatusRow): PartStepStatus {
  return {
    id: row.id,
    partId: row.part_id,
    stepId: row.step_id,
    stepIndex: row.step_index,
    status: row.status as PartStepStatus['status'],
    updatedAt: row.updated_at,
  }
}

export class SQLitePartStepStatusRepository implements PartStepStatusRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(status: PartStepStatus): PartStepStatus {
    this.db.prepare(`
      INSERT INTO part_step_statuses (id, part_id, step_id, step_index, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(status.id, status.partId, status.stepId, status.stepIndex, status.status, status.updatedAt)
    return status
  }

  createBatch(statuses: PartStepStatus[]): PartStepStatus[] {
    const insert = this.db.prepare(`
      INSERT INTO part_step_statuses (id, part_id, step_id, step_index, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const s of statuses) {
        insert.run(s.id, s.partId, s.stepId, s.stepIndex, s.status, s.updatedAt)
      }
    })()
    return statuses
  }

  getByPartAndStep(partId: string, stepId: string): PartStepStatus | null {
    const row = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? AND step_id = ?'
    ).get(partId, stepId) as PartStepStatusRow | undefined
    return row ? rowToDomain(row) : null
  }

  listByPartId(partId: string): PartStepStatus[] {
    const rows = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? ORDER BY step_index ASC'
    ).all(partId) as PartStepStatusRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<PartStepStatus>): PartStepStatus {
    const row = this.db.prepare('SELECT * FROM part_step_statuses WHERE id = ?').get(id) as PartStepStatusRow | undefined
    if (!row) throw new NotFoundError('PartStepStatus', id)

    const existing = rowToDomain(row)
    const updated: PartStepStatus = { ...existing, ...partial, id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE part_step_statuses SET status = ?, updated_at = ? WHERE id = ?
    `).run(updated.status, updated.updatedAt, id)
    return updated
  }

  updateByPartAndStep(partId: string, stepId: string, partial: Partial<PartStepStatus>): PartStepStatus {
    const row = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? AND step_id = ?'
    ).get(partId, stepId) as PartStepStatusRow | undefined
    if (!row) throw new NotFoundError('PartStepStatus', `${partId}/${stepId}`)

    const existing = rowToDomain(row)
    const updated: PartStepStatus = { ...existing, ...partial, id: existing.id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE part_step_statuses SET status = ?, updated_at = ? WHERE part_id = ? AND step_id = ?
    `).run(updated.status, updated.updatedAt, partId, stepId)
    return updated
  }

  // ---- Backward-compatible aliases (used by services not yet renamed) ----

  /** @deprecated Use `getByPartAndStep` instead. */
  getBySerialAndStep(serialId: string, stepId: string): PartStepStatus | null {
    return this.getByPartAndStep(serialId, stepId)
  }

  /** @deprecated Use `listByPartId` instead. */
  listBySerialId(serialId: string): PartStepStatus[] {
    return this.listByPartId(serialId)
  }

  /** @deprecated Use `updateByPartAndStep` instead. */
  updateBySerialAndStep(serialId: string, stepId: string, partial: Partial<PartStepStatus>): PartStepStatus {
    return this.updateByPartAndStep(serialId, stepId, partial)
  }
}
