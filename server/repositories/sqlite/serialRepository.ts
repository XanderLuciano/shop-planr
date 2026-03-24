import type Database from 'better-sqlite3'
import type { SerialNumber } from '../../types/domain'
import type { SerialRepository } from '../interfaces/serialRepository'
import { NotFoundError } from '../../utils/errors'

interface SerialRow {
  id: string
  job_id: string
  path_id: string
  current_step_index: number
  status: string
  scrap_reason: string | null
  scrap_explanation: string | null
  scrap_step_id: string | null
  scrapped_at: string | null
  scrapped_by: string | null
  force_completed: number
  force_completed_by: string | null
  force_completed_at: string | null
  force_completed_reason: string | null
  created_at: string
  updated_at: string
}

function rowToDomain(row: SerialRow): SerialNumber {
  return {
    id: row.id,
    jobId: row.job_id,
    pathId: row.path_id,
    currentStepIndex: row.current_step_index,
    status: row.status as SerialNumber['status'],
    scrapReason: (row.scrap_reason as SerialNumber['scrapReason']) ?? undefined,
    scrapExplanation: row.scrap_explanation ?? undefined,
    scrapStepId: row.scrap_step_id ?? undefined,
    scrappedAt: row.scrapped_at ?? undefined,
    scrappedBy: row.scrapped_by ?? undefined,
    forceCompleted: row.force_completed === 1,
    forceCompletedBy: row.force_completed_by ?? undefined,
    forceCompletedAt: row.force_completed_at ?? undefined,
    forceCompletedReason: row.force_completed_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SQLiteSerialRepository implements SerialRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(serial: SerialNumber): SerialNumber {
    this.db.prepare(`
      INSERT INTO serials (id, job_id, path_id, current_step_index, status, scrap_reason, scrap_explanation, scrap_step_id, scrapped_at, scrapped_by, force_completed, force_completed_by, force_completed_at, force_completed_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      serial.id, serial.jobId, serial.pathId, serial.currentStepIndex,
      serial.status ?? 'in_progress',
      serial.scrapReason ?? null, serial.scrapExplanation ?? null, serial.scrapStepId ?? null,
      serial.scrappedAt ?? null, serial.scrappedBy ?? null,
      serial.forceCompleted ? 1 : 0,
      serial.forceCompletedBy ?? null, serial.forceCompletedAt ?? null, serial.forceCompletedReason ?? null,
      serial.createdAt, serial.updatedAt,
    )
    return serial
  }

  createBatch(serials: SerialNumber[]): SerialNumber[] {
    const insert = this.db.prepare(`
      INSERT INTO serials (id, job_id, path_id, current_step_index, status, scrap_reason, scrap_explanation, scrap_step_id, scrapped_at, scrapped_by, force_completed, force_completed_by, force_completed_at, force_completed_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const serial of serials) {
        insert.run(
          serial.id, serial.jobId, serial.pathId, serial.currentStepIndex,
          serial.status ?? 'in_progress',
          serial.scrapReason ?? null, serial.scrapExplanation ?? null, serial.scrapStepId ?? null,
          serial.scrappedAt ?? null, serial.scrappedBy ?? null,
          serial.forceCompleted ? 1 : 0,
          serial.forceCompletedBy ?? null, serial.forceCompletedAt ?? null, serial.forceCompletedReason ?? null,
          serial.createdAt, serial.updatedAt,
        )
      }
    })()
    return serials
  }

  getById(id: string): SerialNumber | null {
    const row = this.db.prepare('SELECT * FROM serials WHERE id = ?').get(id) as SerialRow | undefined
    return row ? rowToDomain(row) : null
  }

  getByIdentifier(identifier: string): SerialNumber | null {
    return this.getById(identifier)
  }

  listByPathId(pathId: string): SerialNumber[] {
    const rows = this.db.prepare('SELECT * FROM serials WHERE path_id = ? ORDER BY created_at ASC').all(pathId) as SerialRow[]
    return rows.map(rowToDomain)
  }

  listByJobId(jobId: string): SerialNumber[] {
    const rows = this.db.prepare('SELECT * FROM serials WHERE job_id = ? ORDER BY created_at ASC').all(jobId) as SerialRow[]
    return rows.map(rowToDomain)
  }

  listByStepIndex(pathId: string, stepIndex: number): SerialNumber[] {
    const rows = this.db.prepare('SELECT * FROM serials WHERE path_id = ? AND current_step_index = ? AND status != \'scrapped\' ORDER BY created_at ASC').all(pathId, stepIndex) as SerialRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<SerialNumber>): SerialNumber {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('SerialNumber', id)

    const updated: SerialNumber = { ...existing, ...partial, id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE serials SET job_id = ?, path_id = ?, current_step_index = ?, status = ?,
        scrap_reason = ?, scrap_explanation = ?, scrap_step_id = ?, scrapped_at = ?, scrapped_by = ?,
        force_completed = ?, force_completed_by = ?, force_completed_at = ?, force_completed_reason = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updated.jobId, updated.pathId, updated.currentStepIndex, updated.status,
      updated.scrapReason ?? null, updated.scrapExplanation ?? null, updated.scrapStepId ?? null,
      updated.scrappedAt ?? null, updated.scrappedBy ?? null,
      updated.forceCompleted ? 1 : 0,
      updated.forceCompletedBy ?? null, updated.forceCompletedAt ?? null, updated.forceCompletedReason ?? null,
      updated.updatedAt, id,
    )
    return updated
  }

  countByJobId(jobId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM serials WHERE job_id = ?').get(jobId) as { count: number }
    return row.count
  }

  countCompletedByJobId(jobId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM serials WHERE job_id = ? AND current_step_index = -1').get(jobId) as { count: number }
    return row.count
  }

  countScrappedByJobId(jobId: string): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM serials WHERE job_id = ? AND status = 'scrapped'").get(jobId) as { count: number }
    return row.count
  }

  listAll(): SerialNumber[] {
    const rows = this.db.prepare('SELECT * FROM serials ORDER BY created_at ASC').all() as SerialRow[]
    return rows.map(rowToDomain)
  }
}
