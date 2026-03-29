import type Database from 'better-sqlite3'
import type { StepNote } from '../../types/domain'
import type { NoteRepository } from '../interfaces/noteRepository'

interface NoteRow {
  id: string
  job_id: string
  path_id: string
  step_id: string
  serial_ids: string
  text: string
  created_by: string
  created_at: string
  pushed_to_jira: number
  jira_comment_id: string | null
}

function rowToDomain(row: NoteRow): StepNote {
  return {
    id: row.id,
    jobId: row.job_id,
    pathId: row.path_id,
    stepId: row.step_id,
    partIds: JSON.parse(row.serial_ids),
    text: row.text,
    createdBy: row.created_by,
    createdAt: row.created_at,
    pushedToJira: row.pushed_to_jira === 1,
    jiraCommentId: row.jira_comment_id ?? undefined,
  }
}

export class SQLiteNoteRepository implements NoteRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(note: StepNote): StepNote {
    this.db
      .prepare(
        `
      INSERT INTO step_notes (id, job_id, path_id, step_id, serial_ids, text, created_by, created_at, pushed_to_jira, jira_comment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        note.id,
        note.jobId,
        note.pathId,
        note.stepId,
        JSON.stringify(note.partIds),
        note.text,
        note.createdBy,
        note.createdAt,
        note.pushedToJira ? 1 : 0,
        note.jiraCommentId ?? null
      )
    return note
  }

  getById(id: string): StepNote | null {
    const row = this.db.prepare('SELECT * FROM step_notes WHERE id = ?').get(id) as
      | NoteRow
      | undefined
    return row ? rowToDomain(row) : null
  }

  listByPartId(partId: string): StepNote[] {
    // Use json_each to search within the JSON array of serial_ids
    const rows = this.db
      .prepare(
        `
      SELECT DISTINCT sn.* FROM step_notes sn, json_each(sn.serial_ids) je
      WHERE je.value = ?
      ORDER BY sn.created_at ASC
    `
      )
      .all(partId) as NoteRow[]
    return rows.map(rowToDomain)
  }

  listByStepId(stepId: string): StepNote[] {
    const rows = this.db
      .prepare('SELECT * FROM step_notes WHERE step_id = ? ORDER BY created_at ASC')
      .all(stepId) as NoteRow[]
    return rows.map(rowToDomain)
  }

  listByJobId(jobId: string): StepNote[] {
    const rows = this.db
      .prepare('SELECT * FROM step_notes WHERE job_id = ? ORDER BY created_at ASC')
      .all(jobId) as NoteRow[]
    return rows.map(rowToDomain)
  }
}
