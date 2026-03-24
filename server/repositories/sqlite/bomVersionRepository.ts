import type Database from 'better-sqlite3'
import type { BomVersion } from '../../types/domain'
import type { BomVersionRepository } from '../interfaces/bomVersionRepository'

interface BomVersionRow {
  id: string
  bom_id: string
  version_number: number
  entries_snapshot: string
  change_description: string | null
  changed_by: string
  created_at: string
}

function rowToDomain(row: BomVersionRow): BomVersion {
  return {
    id: row.id,
    bomId: row.bom_id,
    versionNumber: row.version_number,
    entriesSnapshot: JSON.parse(row.entries_snapshot),
    changeDescription: row.change_description ?? undefined,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  }
}

export class SQLiteBomVersionRepository implements BomVersionRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(version: BomVersion): BomVersion {
    this.db.prepare(`
      INSERT INTO bom_versions (id, bom_id, version_number, entries_snapshot, change_description, changed_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      version.id,
      version.bomId,
      version.versionNumber,
      JSON.stringify(version.entriesSnapshot),
      version.changeDescription ?? null,
      version.changedBy,
      version.createdAt,
    )
    return version
  }

  listByBomId(bomId: string): BomVersion[] {
    const rows = this.db.prepare(
      'SELECT * FROM bom_versions WHERE bom_id = ? ORDER BY version_number DESC'
    ).all(bomId) as BomVersionRow[]
    return rows.map(rowToDomain)
  }

  getLatestByBomId(bomId: string): BomVersion | null {
    const row = this.db.prepare(
      'SELECT * FROM bom_versions WHERE bom_id = ? ORDER BY version_number DESC LIMIT 1'
    ).get(bomId) as BomVersionRow | undefined
    return row ? rowToDomain(row) : null
  }
}
