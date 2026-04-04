/**
 * Backward compatibility: Both legacy `SN-` prefixed IDs and new `part_` prefixed IDs
 * are supported. All lookups use plain `WHERE id = ?` against the `parts` table,
 * so any TEXT primary key works regardless of prefix format.
 */
import type Database from 'better-sqlite3'
import type { Part } from '../../types/domain'
import type { PartRepository } from '../interfaces/partRepository'
import { NotFoundError } from '../../utils/errors'

interface PartRow {
  id: string
  job_id: string
  path_id: string
  current_step_id: string | null
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

function rowToDomain(row: PartRow): Part {
  return {
    id: row.id,
    jobId: row.job_id,
    pathId: row.path_id,
    currentStepId: row.current_step_id,
    status: row.status as Part['status'],
    scrapReason: (row.scrap_reason as Part['scrapReason']) ?? undefined,
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

export class SQLitePartRepository implements PartRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(part: Part): Part {
    this.db.prepare(`
      INSERT INTO parts (id, job_id, path_id, current_step_id, status, scrap_reason, scrap_explanation, scrap_step_id, scrapped_at, scrapped_by, force_completed, force_completed_by, force_completed_at, force_completed_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      part.id, part.jobId, part.pathId, part.currentStepId,
      part.status ?? 'in_progress',
      part.scrapReason ?? null, part.scrapExplanation ?? null, part.scrapStepId ?? null,
      part.scrappedAt ?? null, part.scrappedBy ?? null,
      part.forceCompleted ? 1 : 0,
      part.forceCompletedBy ?? null, part.forceCompletedAt ?? null, part.forceCompletedReason ?? null,
      part.createdAt, part.updatedAt,
    )
    return part
  }

  createBatch(parts: Part[]): Part[] {
    const insert = this.db.prepare(`
      INSERT INTO parts (id, job_id, path_id, current_step_id, status, scrap_reason, scrap_explanation, scrap_step_id, scrapped_at, scrapped_by, force_completed, force_completed_by, force_completed_at, force_completed_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.db.transaction(() => {
      for (const part of parts) {
        insert.run(
          part.id, part.jobId, part.pathId, part.currentStepId,
          part.status ?? 'in_progress',
          part.scrapReason ?? null, part.scrapExplanation ?? null, part.scrapStepId ?? null,
          part.scrappedAt ?? null, part.scrappedBy ?? null,
          part.forceCompleted ? 1 : 0,
          part.forceCompletedBy ?? null, part.forceCompletedAt ?? null, part.forceCompletedReason ?? null,
          part.createdAt, part.updatedAt,
        )
      }
    })()
    return parts
  }

  getById(id: string): Part | null {
    const row = this.db.prepare('SELECT * FROM parts WHERE id = ?').get(id) as PartRow | undefined
    return row ? rowToDomain(row) : null
  }

  getByIdentifier(identifier: string): Part | null {
    return this.getById(identifier)
  }

  listByPathId(pathId: string): Part[] {
    const rows = this.db.prepare('SELECT * FROM parts WHERE path_id = ? ORDER BY created_at ASC').all(pathId) as PartRow[]
    return rows.map(rowToDomain)
  }

  listByJobId(jobId: string): Part[] {
    const rows = this.db.prepare('SELECT * FROM parts WHERE job_id = ? ORDER BY created_at ASC').all(jobId) as PartRow[]
    return rows.map(rowToDomain)
  }

  listByCurrentStepId(stepId: string): Part[] {
    const rows = this.db.prepare(
      'SELECT * FROM parts WHERE current_step_id = ? AND status != \'scrapped\' ORDER BY created_at ASC',
    ).all(stepId) as PartRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<Part>): Part {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('Part', id)

    const updated: Part = { ...existing, ...partial, id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE parts SET job_id = ?, path_id = ?, current_step_id = ?, status = ?,
        scrap_reason = ?, scrap_explanation = ?, scrap_step_id = ?, scrapped_at = ?, scrapped_by = ?,
        force_completed = ?, force_completed_by = ?, force_completed_at = ?, force_completed_reason = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updated.jobId, updated.pathId, updated.currentStepId, updated.status,
      updated.scrapReason ?? null, updated.scrapExplanation ?? null, updated.scrapStepId ?? null,
      updated.scrappedAt ?? null, updated.scrappedBy ?? null,
      updated.forceCompleted ? 1 : 0,
      updated.forceCompletedBy ?? null, updated.forceCompletedAt ?? null, updated.forceCompletedReason ?? null,
      updated.updatedAt, id,
    )
    return updated
  }

  countByJobId(jobId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM parts WHERE job_id = ?').get(jobId) as { count: number }
    return row.count
  }

  countCompletedByJobId(jobId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM parts WHERE job_id = ? AND current_step_id IS NULL AND status = \'completed\'',
    ).get(jobId) as { count: number }
    return row.count
  }

  countScrappedByJobId(jobId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM parts WHERE job_id = ? AND status = \'scrapped\'').get(jobId) as { count: number }
    return row.count
  }

  listAll(): Part[] {
    const rows = this.db.prepare('SELECT * FROM parts ORDER BY created_at ASC').all() as PartRow[]
    return rows.map(rowToDomain)
  }

  deleteByPathId(pathId: string): number {
    const result = this.db.prepare('DELETE FROM parts WHERE path_id = ?').run(pathId)
    return result.changes
  }
}
