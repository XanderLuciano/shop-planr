import type Database from 'better-sqlite3'
import type { ProcessLibraryEntry, LocationLibraryEntry } from '../../types/domain'
import type { LibraryRepository } from '../interfaces/libraryRepository'

interface ProcessRow {
  id: string
  name: string
  created_at: string
}

interface LocationRow {
  id: string
  name: string
  created_at: string
}

function processRowToDomain(row: ProcessRow): ProcessLibraryEntry {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

function locationRowToDomain(row: LocationRow): LocationLibraryEntry {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

export class SQLiteLibraryRepository implements LibraryRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listProcesses(): ProcessLibraryEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM process_library ORDER BY name ASC')
      .all() as ProcessRow[]
    return rows.map(processRowToDomain)
  }

  createProcess(entry: ProcessLibraryEntry): ProcessLibraryEntry {
    this.db
      .prepare(
        `
      INSERT INTO process_library (id, name, created_at) VALUES (?, ?, ?)
    `
      )
      .run(entry.id, entry.name, entry.createdAt)
    return entry
  }

  deleteProcess(id: string): boolean {
    const result = this.db.prepare('DELETE FROM process_library WHERE id = ?').run(id)
    return result.changes > 0
  }

  listLocations(): LocationLibraryEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM location_library ORDER BY name ASC')
      .all() as LocationRow[]
    return rows.map(locationRowToDomain)
  }

  createLocation(entry: LocationLibraryEntry): LocationLibraryEntry {
    this.db
      .prepare(
        `
      INSERT INTO location_library (id, name, created_at) VALUES (?, ?, ?)
    `
      )
      .run(entry.id, entry.name, entry.createdAt)
    return entry
  }

  deleteLocation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM location_library WHERE id = ?').run(id)
    return result.changes > 0
  }
}
