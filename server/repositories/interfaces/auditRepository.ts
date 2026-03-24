import type { AuditEntry } from '../../types/domain'

/**
 * Audit repository is append-only — no update or delete operations.
 */
export interface AuditRepository {
  create(entry: AuditEntry): AuditEntry
  listBySerialId(serialId: string): AuditEntry[]
  listByJobId(jobId: string): AuditEntry[]
  list(options?: { limit?: number, offset?: number }): AuditEntry[]
}
