import type Database from 'better-sqlite3'
import type { BOM } from '../../types/domain'
import type { BomRepository } from '../interfaces/bomRepository'
import { NotFoundError } from '../../utils/errors'

interface BomRow {
  id: string
  name: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

interface BomEntryRow {
  id: number
  bom_id: string
  job_id: string
  required_quantity: number
}

function buildBomDomain(row: BomRow, entryRows: BomEntryRow[]): BOM {
  return {
    id: row.id,
    name: row.name,
    archivedAt: row.archived_at ?? null,
    entries: entryRows.map(e => ({
      id: String(e.id),
      bomId: e.bom_id,
      jobId: e.job_id,
      requiredQuantity: e.required_quantity,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SQLiteBomRepository implements BomRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(bom: BOM): BOM {
    const insertBom = this.db.prepare(
      'INSERT INTO boms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    const insertEntry = this.db.prepare(
      'INSERT INTO bom_entries (bom_id, job_id, required_quantity) VALUES (?, ?, ?)',
    )

    this.db.transaction(() => {
      insertBom.run(bom.id, bom.name, bom.createdAt, bom.updatedAt)
      for (const entry of bom.entries) {
        insertEntry.run(bom.id, entry.jobId, entry.requiredQuantity)
      }
    })()

    return this.getById(bom.id)!
  }

  getById(id: string): BOM | null {
    const row = this.db.prepare('SELECT * FROM boms WHERE id = ?').get(id) as BomRow | undefined
    if (!row) return null

    const entryRows = this.db.prepare(
      'SELECT * FROM bom_entries WHERE bom_id = ?',
    ).all(id) as BomEntryRow[]

    return buildBomDomain(row, entryRows)
  }

  list(status: 'active' | 'archived' | 'all' = 'active'): BOM[] {
    const sql = status === 'all'
      ? 'SELECT * FROM boms ORDER BY created_at DESC'
      : status === 'archived'
        ? 'SELECT * FROM boms WHERE archived_at IS NOT NULL ORDER BY created_at DESC'
        : 'SELECT * FROM boms WHERE archived_at IS NULL ORDER BY created_at DESC'
    const rows = this.db.prepare(sql).all() as BomRow[]
    return rows.map(row => this.getById(row.id)!)
  }

  update(id: string, partial: Partial<BOM>): BOM {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('BOM', id)

    const updated: BOM = {
      ...existing,
      ...partial,
      id,
      updatedAt: partial.updatedAt ?? new Date().toISOString(),
    }

    const updateBom = this.db.prepare(
      'UPDATE boms SET name = ?, archived_at = ?, updated_at = ? WHERE id = ?',
    )
    const deleteEntries = this.db.prepare('DELETE FROM bom_entries WHERE bom_id = ?')
    const insertEntry = this.db.prepare(
      'INSERT INTO bom_entries (bom_id, job_id, required_quantity) VALUES (?, ?, ?)',
    )

    this.db.transaction(() => {
      updateBom.run(updated.name, updated.archivedAt ?? null, updated.updatedAt, id)
      if (partial.entries) {
        deleteEntries.run(id)
        for (const entry of updated.entries) {
          insertEntry.run(id, entry.jobId, entry.requiredQuantity)
        }
      }
    })()

    return this.getById(id)!
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM boms WHERE id = ?').run(id)
    return result.changes > 0
  }

  countJobRefs(jobId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS cnt FROM bom_entries WHERE job_id = ?',
    ).get(jobId) as { cnt: number } | undefined
    return row?.cnt ?? 0
  }
}
