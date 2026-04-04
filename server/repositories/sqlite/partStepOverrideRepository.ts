import type Database from 'better-sqlite3'
import type { PartStepOverride } from '../../types/domain'
import type { PartStepOverrideRepository } from '../interfaces/partStepOverrideRepository'
import { NotFoundError } from '../../utils/errors'

interface PartStepOverrideRow {
  id: string
  part_id: string
  step_id: string
  active: number
  reason: string | null
  created_by: string
  created_at: string
}

function rowToDomain(row: PartStepOverrideRow): PartStepOverride {
  return {
    id: row.id,
    partId: row.part_id,
    stepId: row.step_id,
    active: row.active === 1,
    reason: row.reason ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export class SQLitePartStepOverrideRepository implements PartStepOverrideRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(override: PartStepOverride): PartStepOverride {
    this.db.prepare(`
      INSERT INTO part_step_overrides (id, part_id, step_id, active, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(override.id, override.partId, override.stepId, override.active ? 1 : 0, override.reason ?? null, override.createdBy, override.createdAt)
    return override
  }

  createBatch(overrides: PartStepOverride[]): PartStepOverride[] {
    const insert = this.db.prepare(`
      INSERT INTO part_step_overrides (id, part_id, step_id, active, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const o of overrides) {
        insert.run(o.id, o.partId, o.stepId, o.active ? 1 : 0, o.reason ?? null, o.createdBy, o.createdAt)
      }
    })()
    return overrides
  }

  getByPartAndStep(partId: string, stepId: string): PartStepOverride | null {
    const row = this.db.prepare(
      'SELECT * FROM part_step_overrides WHERE part_id = ? AND step_id = ?',
    ).get(partId, stepId) as PartStepOverrideRow | undefined
    return row ? rowToDomain(row) : null
  }

  listByPartId(partId: string): PartStepOverride[] {
    const rows = this.db.prepare(
      'SELECT * FROM part_step_overrides WHERE part_id = ? ORDER BY created_at ASC',
    ).all(partId) as PartStepOverrideRow[]
    return rows.map(rowToDomain)
  }

  listActiveByPartId(partId: string): PartStepOverride[] {
    const rows = this.db.prepare(
      'SELECT * FROM part_step_overrides WHERE part_id = ? AND active = 1 ORDER BY created_at ASC',
    ).all(partId) as PartStepOverrideRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<PartStepOverride>): PartStepOverride {
    const row = this.db.prepare('SELECT * FROM part_step_overrides WHERE id = ?').get(id) as PartStepOverrideRow | undefined
    if (!row) throw new NotFoundError('PartStepOverride', id)

    const existing = rowToDomain(row)
    const updated: PartStepOverride = { ...existing, ...partial, id }

    this.db.prepare(`
      UPDATE part_step_overrides SET active = ?, reason = ? WHERE id = ?
    `).run(updated.active ? 1 : 0, updated.reason ?? null, id)
    return updated
  }

  // ---- Backward-compatible aliases (used by services not yet renamed) ----

  /** @deprecated Use `getByPartAndStep` instead. */
  getBySerialAndStep(serialId: string, stepId: string): PartStepOverride | null {
    return this.getByPartAndStep(serialId, stepId)
  }

  /** @deprecated Use `listByPartId` instead. */
  listBySerialId(serialId: string): PartStepOverride[] {
    return this.listByPartId(serialId)
  }

  /** @deprecated Use `listActiveByPartId` instead. */
  listActiveBySerialId(serialId: string): PartStepOverride[] {
    return this.listActiveByPartId(serialId)
  }

  deleteByPartIds(partIds: string[]): number {
    if (partIds.length === 0) return 0
    const CHUNK_SIZE = 500
    let totalChanges = 0
    for (let i = 0; i < partIds.length; i += CHUNK_SIZE) {
      const chunk = partIds.slice(i, i + CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(',')
      const result = this.db.prepare(
        `DELETE FROM part_step_overrides WHERE part_id IN (${placeholders})`,
      ).run(...chunk)
      totalChanges += result.changes
    }
    return totalChanges
  }
}
