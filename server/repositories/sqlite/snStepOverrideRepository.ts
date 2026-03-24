import type Database from 'better-sqlite3'
import type { SnStepOverride } from '../../types/domain'
import type { SnStepOverrideRepository } from '../interfaces/snStepOverrideRepository'
import { NotFoundError } from '../../utils/errors'

interface SnStepOverrideRow {
  id: string
  serial_id: string
  step_id: string
  active: number
  reason: string | null
  created_by: string
  created_at: string
}

function rowToDomain(row: SnStepOverrideRow): SnStepOverride {
  return {
    id: row.id,
    serialId: row.serial_id,
    stepId: row.step_id,
    active: row.active === 1,
    reason: row.reason ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export class SQLiteSnStepOverrideRepository implements SnStepOverrideRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(override: SnStepOverride): SnStepOverride {
    this.db.prepare(`
      INSERT INTO sn_step_overrides (id, serial_id, step_id, active, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(override.id, override.serialId, override.stepId, override.active ? 1 : 0, override.reason ?? null, override.createdBy, override.createdAt)
    return override
  }

  createBatch(overrides: SnStepOverride[]): SnStepOverride[] {
    const insert = this.db.prepare(`
      INSERT INTO sn_step_overrides (id, serial_id, step_id, active, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const o of overrides) {
        insert.run(o.id, o.serialId, o.stepId, o.active ? 1 : 0, o.reason ?? null, o.createdBy, o.createdAt)
      }
    })()
    return overrides
  }

  getBySerialAndStep(serialId: string, stepId: string): SnStepOverride | null {
    const row = this.db.prepare(
      'SELECT * FROM sn_step_overrides WHERE serial_id = ? AND step_id = ?'
    ).get(serialId, stepId) as SnStepOverrideRow | undefined
    return row ? rowToDomain(row) : null
  }

  listBySerialId(serialId: string): SnStepOverride[] {
    const rows = this.db.prepare(
      'SELECT * FROM sn_step_overrides WHERE serial_id = ? ORDER BY created_at ASC'
    ).all(serialId) as SnStepOverrideRow[]
    return rows.map(rowToDomain)
  }

  listActiveBySerialId(serialId: string): SnStepOverride[] {
    const rows = this.db.prepare(
      'SELECT * FROM sn_step_overrides WHERE serial_id = ? AND active = 1 ORDER BY created_at ASC'
    ).all(serialId) as SnStepOverrideRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<SnStepOverride>): SnStepOverride {
    const row = this.db.prepare('SELECT * FROM sn_step_overrides WHERE id = ?').get(id) as SnStepOverrideRow | undefined
    if (!row) throw new NotFoundError('SnStepOverride', id)

    const existing = rowToDomain(row)
    const updated: SnStepOverride = { ...existing, ...partial, id }

    this.db.prepare(`
      UPDATE sn_step_overrides SET active = ?, reason = ? WHERE id = ?
    `).run(updated.active ? 1 : 0, updated.reason ?? null, id)
    return updated
  }
}
