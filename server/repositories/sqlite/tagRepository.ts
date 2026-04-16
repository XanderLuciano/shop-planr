import type Database from 'better-sqlite3'
import type { Tag } from '../../types/domain'
import type { TagRepository } from '../interfaces/tagRepository'
import { type TagRow, rowToTag } from './tagMapper'

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

    const results: Tag[] = []
    for (let i = 0; i < ids.length; i += SQLiteTagRepository.CHUNK_SIZE) {
      const chunk = ids.slice(i, i + SQLiteTagRepository.CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(', ')
      const rows = this.db.prepare(`SELECT * FROM tags WHERE id IN (${placeholders})`).all(...chunk) as TagRow[]
      results.push(...rows.map(rowToTag))
    }
    return results
  }

  create(tag: Tag): Tag {
    this.db.prepare(`
      INSERT INTO tags (id, name, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tag.id, tag.name, tag.color, tag.createdAt, tag.updatedAt)
    return tag
  }

  private static readonly CHUNK_SIZE = 900

  update(id: string, partial: Partial<Tag>): Tag {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Tag not found: ${id}`)

    const updated: Tag = {
      ...existing,
      ...partial,
      id, // ensure id is not overwritten
      createdAt: existing.createdAt, // never allow createdAt to be overwritten
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
