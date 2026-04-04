import type Database from 'better-sqlite3'
import type { BOM } from '../../types/domain'
import type { BomRepository } from '../interfaces/bomRepository'
import { NotFoundError } from '../../utils/errors'

interface BomRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface BomEntryRow {
  id: number
  bom_id: string
  part_type: string
  required_quantity_per_build: number
}

interface ContribJobRow {
  bom_entry_id: number
  job_id: string
}

function buildBomDomain(row: BomRow, entryRows: BomEntryRow[], contribRows: ContribJobRow[]): BOM {
  const contribMap = new Map<number, string[]>()
  for (const c of contribRows) {
    const list = contribMap.get(c.bom_entry_id) ?? []
    list.push(c.job_id)
    contribMap.set(c.bom_entry_id, list)
  }

  return {
    id: row.id,
    name: row.name,
    entries: entryRows.map(e => ({
      id: String(e.id),
      bomId: e.bom_id,
      partType: e.part_type,
      requiredQuantityPerBuild: e.required_quantity_per_build,
      contributingJobIds: contribMap.get(e.id) ?? [],
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
    const insertBom = this.db.prepare(`
      INSERT INTO boms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
    `)
    const insertEntry = this.db.prepare(`
      INSERT INTO bom_entries (bom_id, part_type, required_quantity_per_build) VALUES (?, ?, ?)
    `)
    const insertContrib = this.db.prepare(`
      INSERT INTO bom_contributing_jobs (bom_entry_id, job_id) VALUES (?, ?)
    `)

    this.db.transaction(() => {
      insertBom.run(bom.id, bom.name, bom.createdAt, bom.updatedAt)
      for (const entry of bom.entries) {
        const result = insertEntry.run(bom.id, entry.partType, entry.requiredQuantityPerBuild)
        const entryId = result.lastInsertRowid as number
        for (const jobId of entry.contributingJobIds) {
          insertContrib.run(entryId, jobId)
        }
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

    const entryIds = entryRows.map(e => e.id)
    let contribRows: ContribJobRow[] = []
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',')
      contribRows = this.db.prepare(
        `SELECT * FROM bom_contributing_jobs WHERE bom_entry_id IN (${placeholders})`,
      ).all(...entryIds) as ContribJobRow[]
    }

    return buildBomDomain(row, entryRows, contribRows)
  }

  list(): BOM[] {
    const rows = this.db.prepare('SELECT * FROM boms ORDER BY created_at DESC').all() as BomRow[]
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

    const updateBom = this.db.prepare('UPDATE boms SET name = ?, updated_at = ? WHERE id = ?')
    const deleteEntries = this.db.prepare('DELETE FROM bom_entries WHERE bom_id = ?')
    const insertEntry = this.db.prepare(`
      INSERT INTO bom_entries (bom_id, part_type, required_quantity_per_build) VALUES (?, ?, ?)
    `)
    const insertContrib = this.db.prepare(`
      INSERT INTO bom_contributing_jobs (bom_entry_id, job_id) VALUES (?, ?)
    `)

    this.db.transaction(() => {
      updateBom.run(updated.name, updated.updatedAt, id)
      if (partial.entries) {
        deleteEntries.run(id)
        for (const entry of updated.entries) {
          const result = insertEntry.run(id, entry.partType, entry.requiredQuantityPerBuild)
          const entryId = result.lastInsertRowid as number
          for (const jobId of entry.contributingJobIds) {
            insertContrib.run(entryId, jobId)
          }
        }
      }
    })()

    return this.getById(id)!
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM boms WHERE id = ?').run(id)
    return result.changes > 0
  }

  countContributingJobRefs(jobId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS cnt FROM bom_contributing_jobs WHERE job_id = ?',
    ).get(jobId) as { cnt: number } | undefined
    return row?.cnt ?? 0
  }
}
