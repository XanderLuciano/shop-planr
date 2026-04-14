import type Database from 'better-sqlite3'
import type { Tag } from '../../types/domain'
import type { JobTagRepository } from '../interfaces/jobTagRepository'

interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

interface JobTagRow extends TagRow {
  job_id: string
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

export class SQLiteJobTagRepository implements JobTagRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getTagsByJobId(jobId: string): Tag[] {
    const rows = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN job_tags jt ON t.id = jt.tag_id
      WHERE jt.job_id = ?
    `).all(jobId) as TagRow[]
    return rows.map(rowToTag)
  }

  getTagsForJobs(jobIds: string[]): Map<string, Tag[]> {
    if (jobIds.length === 0) return new Map()

    const placeholders = jobIds.map(() => '?').join(', ')
    const rows = this.db.prepare(`
      SELECT jt.job_id, t.id, t.name, t.color, t.created_at, t.updated_at
      FROM job_tags jt
      JOIN tags t ON jt.tag_id = t.id
      WHERE jt.job_id IN (${placeholders})
    `).all(...jobIds) as JobTagRow[]

    const result = new Map<string, Tag[]>()
    for (const row of rows) {
      const { job_id, ...tagRow } = row
      if (!result.has(job_id)) result.set(job_id, [])
      result.get(job_id)!.push(rowToTag(tagRow))
    }
    return result
  }

  replaceJobTags(jobId: string, tagIds: string[]): void {
    const replace = this.db.transaction(() => {
      this.db.prepare('DELETE FROM job_tags WHERE job_id = ?').run(jobId)
      const insert = this.db.prepare('INSERT INTO job_tags (job_id, tag_id) VALUES (?, ?)')
      for (const tagId of tagIds) {
        insert.run(jobId, tagId)
      }
    })
    replace()
  }

  removeAllTagsForJob(jobId: string): void {
    this.db.prepare('DELETE FROM job_tags WHERE job_id = ?').run(jobId)
  }

  countJobsByTagId(tagId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM job_tags WHERE tag_id = ?').get(tagId) as { count: number }
    return row.count
  }
}
