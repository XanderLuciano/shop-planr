import type Database from 'better-sqlite3'
import type { Tag } from '../../types/domain'
import type { JobTagRepository } from '../interfaces/jobTagRepository'
import { type TagRow, rowToTag } from './tagMapper'

interface JobTagRow extends TagRow {
  job_id: string
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

  /** SQLite has a default limit of 999 bound parameters. Chunk large lists. */
  private static readonly CHUNK_SIZE = 900

  getTagsForJobs(jobIds: string[]): Map<string, Tag[]> {
    if (jobIds.length === 0) return new Map()

    const result = new Map<string, Tag[]>()

    for (let i = 0; i < jobIds.length; i += SQLiteJobTagRepository.CHUNK_SIZE) {
      const chunk = jobIds.slice(i, i + SQLiteJobTagRepository.CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(', ')
      const rows = this.db.prepare(`
        SELECT jt.job_id, t.id, t.name, t.color, t.created_at, t.updated_at
        FROM job_tags jt
        JOIN tags t ON jt.tag_id = t.id
        WHERE jt.job_id IN (${placeholders})
      `).all(...chunk) as JobTagRow[]

      for (const row of rows) {
        const { job_id, ...tagRow } = row
        if (!result.has(job_id)) result.set(job_id, [])
        result.get(job_id)!.push(rowToTag(tagRow))
      }
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

  getJobIdsByTagId(tagId: string): string[] {
    const rows = this.db.prepare('SELECT job_id FROM job_tags WHERE tag_id = ?').all(tagId) as { job_id: string }[]
    return rows.map(r => r.job_id)
  }
}
