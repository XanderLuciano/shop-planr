import type Database from 'better-sqlite3'
import type { Job } from '../../types/domain'
import type { JobRepository } from '../interfaces/jobRepository'
import { NotFoundError } from '../../utils/errors'

interface JobRow {
  id: string
  name: string
  goal_quantity: number
  priority: number
  jira_ticket_key: string | null
  jira_ticket_summary: string | null
  jira_part_number: string | null
  jira_priority: string | null
  jira_epic_link: string | null
  jira_labels: string | null
  created_at: string
  updated_at: string
}

function rowToDomain(row: JobRow): Job {
  return {
    id: row.id,
    name: row.name,
    goalQuantity: row.goal_quantity,
    priority: row.priority,
    jiraTicketKey: row.jira_ticket_key ?? undefined,
    jiraTicketSummary: row.jira_ticket_summary ?? undefined,
    jiraPartNumber: row.jira_part_number ?? undefined,
    jiraPriority: row.jira_priority ?? undefined,
    jiraEpicLink: row.jira_epic_link ?? undefined,
    jiraLabels: row.jira_labels ? JSON.parse(row.jira_labels) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SQLiteJobRepository implements JobRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createWithAutoIncPriority(job: Omit<Job, 'priority'>): Job {
    const fullJob = this.db.transaction(() => {
      const maxRow = this.db.prepare('SELECT COALESCE(MAX(priority), 0) AS max_priority FROM jobs').get() as { max_priority: number }
      const priority = maxRow.max_priority + 1
      const jobWithPriority = { ...job, priority } as Job
      this.db.prepare(`
        INSERT INTO jobs (id, name, goal_quantity, priority, jira_ticket_key, jira_ticket_summary, jira_part_number, jira_priority, jira_epic_link, jira_labels, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobWithPriority.id,
        jobWithPriority.name,
        jobWithPriority.goalQuantity,
        jobWithPriority.priority,
        jobWithPriority.jiraTicketKey ?? null,
        jobWithPriority.jiraTicketSummary ?? null,
        jobWithPriority.jiraPartNumber ?? null,
        jobWithPriority.jiraPriority ?? null,
        jobWithPriority.jiraEpicLink ?? null,
        jobWithPriority.jiraLabels ? JSON.stringify(jobWithPriority.jiraLabels) : null,
        jobWithPriority.createdAt,
        jobWithPriority.updatedAt,
      )
      return jobWithPriority
    })()
    return fullJob
  }

  create(job: Job): Job {
    this.db.prepare(`
      INSERT INTO jobs (id, name, goal_quantity, priority, jira_ticket_key, jira_ticket_summary, jira_part_number, jira_priority, jira_epic_link, jira_labels, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.name,
      job.goalQuantity,
      job.priority,
      job.jiraTicketKey ?? null,
      job.jiraTicketSummary ?? null,
      job.jiraPartNumber ?? null,
      job.jiraPriority ?? null,
      job.jiraEpicLink ?? null,
      job.jiraLabels ? JSON.stringify(job.jiraLabels) : null,
      job.createdAt,
      job.updatedAt,
    )
    return job
  }

  getById(id: string): Job | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
    return row ? rowToDomain(row) : null
  }

  list(): Job[] {
    const rows = this.db.prepare('SELECT * FROM jobs ORDER BY CASE WHEN priority = 0 THEN 1 ELSE 0 END, priority ASC').all() as JobRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<Job>): Job {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('Job', id)

    const updated: Job = { ...existing, ...partial, id, updatedAt: partial.updatedAt ?? new Date().toISOString() }

    this.db.prepare(`
      UPDATE jobs SET name = ?, goal_quantity = ?, priority = ?, jira_ticket_key = ?, jira_ticket_summary = ?, jira_part_number = ?, jira_priority = ?, jira_epic_link = ?, jira_labels = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.goalQuantity,
      updated.priority,
      updated.jiraTicketKey ?? null,
      updated.jiraTicketSummary ?? null,
      updated.jiraPartNumber ?? null,
      updated.jiraPriority ?? null,
      updated.jiraEpicLink ?? null,
      updated.jiraLabels ? JSON.stringify(updated.jiraLabels) : null,
      updated.updatedAt,
      id,
    )
    return updated
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    return result.changes > 0
  }

  bulkUpdatePriority(entries: { id: string, priority: number }[]): void {
    const stmt = this.db.prepare('UPDATE jobs SET priority = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()

    this.db.transaction(() => {
      for (const entry of entries) {
        stmt.run(entry.priority, now, entry.id)
      }
    })()
  }

  getMaxPriority(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(priority), 0) AS max_priority FROM jobs').get() as { max_priority: number }
    return row.max_priority
  }
}
