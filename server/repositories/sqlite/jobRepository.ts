import type Database from 'better-sqlite3'
import type { Job } from '../../types/domain'
import type { JobRepository } from '../interfaces/jobRepository'
import { NotFoundError } from '../../utils/errors'

interface JobRow {
  id: string
  name: string
  goal_quantity: number
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

  create(job: Job): Job {
    this.db
      .prepare(
        `
      INSERT INTO jobs (id, name, goal_quantity, jira_ticket_key, jira_ticket_summary, jira_part_number, jira_priority, jira_epic_link, jira_labels, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        job.id,
        job.name,
        job.goalQuantity,
        job.jiraTicketKey ?? null,
        job.jiraTicketSummary ?? null,
        job.jiraPartNumber ?? null,
        job.jiraPriority ?? null,
        job.jiraEpicLink ?? null,
        job.jiraLabels ? JSON.stringify(job.jiraLabels) : null,
        job.createdAt,
        job.updatedAt
      )
    return job
  }

  getById(id: string): Job | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
    return row ? rowToDomain(row) : null
  }

  list(): Job[] {
    const rows = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as JobRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<Job>): Job {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('Job', id)

    const updated: Job = {
      ...existing,
      ...partial,
      id,
      updatedAt: partial.updatedAt ?? new Date().toISOString(),
    }

    this.db
      .prepare(
        `
      UPDATE jobs SET name = ?, goal_quantity = ?, jira_ticket_key = ?, jira_ticket_summary = ?, jira_part_number = ?, jira_priority = ?, jira_epic_link = ?, jira_labels = ?, updated_at = ?
      WHERE id = ?
    `
      )
      .run(
        updated.name,
        updated.goalQuantity,
        updated.jiraTicketKey ?? null,
        updated.jiraTicketSummary ?? null,
        updated.jiraPartNumber ?? null,
        updated.jiraPriority ?? null,
        updated.jiraEpicLink ?? null,
        updated.jiraLabels ? JSON.stringify(updated.jiraLabels) : null,
        updated.updatedAt,
        id
      )
    return updated
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    return result.changes > 0
  }
}
