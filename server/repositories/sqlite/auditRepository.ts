import type Database from 'better-sqlite3'
import type { AuditEntry } from '../../types/domain'
import type { AuditRepository } from '../interfaces/auditRepository'

interface AuditRow {
  id: string
  action: string
  user_id: string
  timestamp: string
  serial_id: string | null
  cert_id: string | null
  job_id: string | null
  path_id: string | null
  step_id: string | null
  from_step_id: string | null
  to_step_id: string | null
  batch_quantity: number | null
  metadata: string | null
}

function rowToDomain(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    action: row.action as AuditEntry['action'],
    userId: row.user_id,
    timestamp: row.timestamp,
    serialId: row.serial_id ?? undefined,
    certId: row.cert_id ?? undefined,
    jobId: row.job_id ?? undefined,
    pathId: row.path_id ?? undefined,
    stepId: row.step_id ?? undefined,
    fromStepId: row.from_step_id ?? undefined,
    toStepId: row.to_step_id ?? undefined,
    batchQuantity: row.batch_quantity ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }
}

export class SQLiteAuditRepository implements AuditRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(entry: AuditEntry): AuditEntry {
    this.db.prepare(`
      INSERT INTO audit_entries (id, action, user_id, timestamp, serial_id, cert_id, job_id, path_id, step_id, from_step_id, to_step_id, batch_quantity, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.action,
      entry.userId,
      entry.timestamp,
      entry.serialId ?? null,
      entry.certId ?? null,
      entry.jobId ?? null,
      entry.pathId ?? null,
      entry.stepId ?? null,
      entry.fromStepId ?? null,
      entry.toStepId ?? null,
      entry.batchQuantity ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    )
    return entry
  }

  listBySerialId(serialId: string): AuditEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM audit_entries WHERE serial_id = ? ORDER BY timestamp ASC'
    ).all(serialId) as AuditRow[]
    return rows.map(rowToDomain)
  }

  listByJobId(jobId: string): AuditEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM audit_entries WHERE job_id = ? ORDER BY timestamp ASC'
    ).all(jobId) as AuditRow[]
    return rows.map(rowToDomain)
  }

  list(options?: { limit?: number, offset?: number }): AuditEntry[] {
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const rows = this.db.prepare(
      'SELECT * FROM audit_entries ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as AuditRow[]
    return rows.map(rowToDomain)
  }
}
