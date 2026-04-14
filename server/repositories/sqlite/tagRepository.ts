import type Database from 'better-sqlite3'
import type { Tag } from '../../types/domain'
import type { TagRepository } from '../interfaces/tagRepository'

interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SQLiteTagRepository implements TagRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(): Tag[] {
    const rows = this.db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as TagRow[]
    return rows.map(rowToTag)
  }

  getById(id: string): Tag | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined
    return row ? rowToTag(row) : null
  }

  getByIds(ids: string[]): Tag[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(', ')
    const rows = this.db.prepare(`SELECT * FROM tags WHERE id IN (${placeholders})`).all(...ids) as TagRow[]
    return rows.map(rowToTag)
  }

  create(tag: Tag): Tag {
    this.db.prepare(`
      INSERT INTO tags (id, name, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tag.id, tag.name, tag.color, tag.createdAt, tag.updatedAt)
    return tag
  }

  update(id: string, partial: Partial<Tag>): Tag {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Tag not found: ${id}`)

    const updated: Tag = {
      ...existing,
      ...partial,
      id, // ensure id is not overwritten
    }

    this.db.prepare(`
      UPDATE tags SET name = ?, color = ?, updated_at = ? WHERE id = ?
    `).run(updated.name, updated.color, updated.updatedAt, id)

    return updated
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return result.changes > 0
  }

  findByName(name: string): Tag | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE LOWER(name) = LOWER(?)').get(name) as TagRow | undefined
    return row ? rowToTag(row) : null
  }
}
