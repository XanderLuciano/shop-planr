import type Database from 'better-sqlite3'
import type { PartStepStatus } from '../../types/domain'
import type { PartStepStatusRepository } from '../interfaces/partStepStatusRepository'
import { NotFoundError } from '../../utils/errors'

interface PartStepStatusRow {
  id: string
  part_id: string
  step_id: string
  sequence_number: number
  status: string
  entered_at: string
  completed_at: string | null
  updated_at: string
}

function rowToDomain(row: PartStepStatusRow): PartStepStatus {
  return {
    id: row.id,
    partId: row.part_id,
    stepId: row.step_id,
    sequenceNumber: row.sequence_number,
    status: row.status as PartStepStatus['status'],
    enteredAt: row.entered_at,
    completedAt: row.completed_at ?? undefined,
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
      INSERT INTO part_step_statuses (id, part_id, step_id, sequence_number, status, entered_at, completed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(status.id, status.partId, status.stepId, status.sequenceNumber, status.status, status.enteredAt, status.completedAt ?? null, status.updatedAt)
    return status
  }

  createBatch(statuses: PartStepStatus[]): PartStepStatus[] {
    const insert = this.db.prepare(`
      INSERT INTO part_step_statuses (id, part_id, step_id, sequence_number, status, entered_at, completed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const s of statuses) {
        insert.run(s.id, s.partId, s.stepId, s.sequenceNumber, s.status, s.enteredAt, s.completedAt ?? null, s.updatedAt)
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

  getLatestByPartAndStep(partId: string, stepId: string): PartStepStatus | null {
    const row = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? AND step_id = ? ORDER BY sequence_number DESC LIMIT 1'
    ).get(partId, stepId) as PartStepStatusRow | undefined
    return row ? rowToDomain(row) : null
  }

  listByPartId(partId: string): PartStepStatus[] {
    const rows = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? ORDER BY sequence_number ASC'
    ).all(partId) as PartStepStatusRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<PartStepStatus>): PartStepStatus {
    const row = this.db.prepare('SELECT * FROM part_step_statuses WHERE id = ?').get(id) as PartStepStatusRow | undefined
    if (!row) throw new NotFoundError('PartStepStatus', id)

    const existing = rowToDomain(row)
    const updated: PartStepStatus = { ...existing, ...partial, id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE part_step_statuses SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `).run(updated.status, updated.completedAt ?? null, updated.updatedAt, id)
    return updated
  }

  updateByPartAndStep(partId: string, stepId: string, partial: Partial<PartStepStatus>): PartStepStatus {
    // Update the latest entry (highest sequence_number) for this part+step
    const row = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? AND step_id = ? ORDER BY sequence_number DESC LIMIT 1'
    ).get(partId, stepId) as PartStepStatusRow | undefined
    if (!row) throw new NotFoundError('PartStepStatus', `${partId}/${stepId}`)

    const existing = rowToDomain(row)
    const updated: PartStepStatus = { ...existing, ...partial, id: existing.id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE part_step_statuses SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `).run(updated.status, updated.completedAt ?? null, updated.updatedAt, existing.id)
    return updated
  }

  updateLatestByPartAndStep(partId: string, stepId: string, partial: Partial<PartStepStatus>): PartStepStatus {
    const row = this.db.prepare(
      'SELECT * FROM part_step_statuses WHERE part_id = ? AND step_id = ? ORDER BY sequence_number DESC LIMIT 1'
    ).get(partId, stepId) as PartStepStatusRow | undefined
    if (!row) throw new NotFoundError('PartStepStatus', `${partId}/${stepId}`)

    const existing = rowToDomain(row)
    const updated: PartStepStatus = { ...existing, ...partial, id: existing.id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE part_step_statuses SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `).run(updated.status, updated.completedAt ?? null, updated.updatedAt, existing.id)
    return updated
  }

  getNextSequenceNumber(partId: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq FROM part_step_statuses WHERE part_id = ?'
    ).get(partId) as { next_seq: number }
    return row.next_seq
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
