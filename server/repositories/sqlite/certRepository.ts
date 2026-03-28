import type Database from 'better-sqlite3'
import type { Certificate, CertAttachment } from '../../types/domain'
import type { CertRepository } from '../interfaces/certRepository'

interface CertRow {
  id: string
  type: string
  name: string
  metadata: string | null
  created_at: string
}

interface AttachmentRow {
  id: number
  part_id: string
  cert_id: string
  step_id: string
  attached_at: string
  attached_by: string
}

function certRowToDomain(row: CertRow): Certificate {
  return {
    id: row.id,
    type: row.type as Certificate['type'],
    name: row.name,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at
  }
}

function attachmentRowToDomain(row: AttachmentRow): CertAttachment {
  return {
    id: String(row.id),
    partId: row.part_id,
    certId: row.cert_id,
    stepId: row.step_id,
    attachedAt: row.attached_at,
    attachedBy: row.attached_by
  }
}

export class SQLiteCertRepository implements CertRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(cert: Certificate): Certificate {
    this.db.prepare(`
      INSERT INTO certs (id, type, name, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(cert.id, cert.type, cert.name, cert.metadata ? JSON.stringify(cert.metadata) : null, cert.createdAt)
    return cert
  }

  getById(id: string): Certificate | null {
    const row = this.db.prepare('SELECT * FROM certs WHERE id = ?').get(id) as CertRow | undefined
    return row ? certRowToDomain(row) : null
  }

  list(): Certificate[] {
    const rows = this.db.prepare('SELECT * FROM certs ORDER BY created_at DESC').all() as CertRow[]
    return rows.map(certRowToDomain)
  }

  attachToPart(attachment: CertAttachment): CertAttachment {
    const result = this.db.prepare(`
      INSERT INTO cert_attachments (part_id, cert_id, step_id, attached_at, attached_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(attachment.partId, attachment.certId, attachment.stepId, attachment.attachedAt, attachment.attachedBy)
    return { ...attachment, id: String(result.lastInsertRowid) }
  }

  getAttachmentsForPart(partId: string): CertAttachment[] {
    const rows = this.db.prepare(
      'SELECT * FROM cert_attachments WHERE part_id = ? ORDER BY attached_at ASC'
    ).all(partId) as AttachmentRow[]
    return rows.map(attachmentRowToDomain)
  }

  listAttachmentsByCertId(certId: string): CertAttachment[] {
    const rows = this.db.prepare(
      'SELECT * FROM cert_attachments WHERE cert_id = ? ORDER BY attached_at ASC'
    ).all(certId) as AttachmentRow[]
    return rows.map(attachmentRowToDomain)
  }

  /** @deprecated Use `attachToPart` instead. Backward-compatible alias. */
  attachToSerial(attachment: CertAttachment): CertAttachment {
    return this.attachToPart(attachment)
  }

  /** @deprecated Use `getAttachmentsForPart` instead. Backward-compatible alias. */
  getAttachmentsForSerial(serialId: string): CertAttachment[] {
    return this.getAttachmentsForPart(serialId)
  }

  batchAttach(attachments: CertAttachment[]): CertAttachment[] {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO cert_attachments (part_id, cert_id, step_id, attached_at, attached_by)
      VALUES (?, ?, ?, ?, ?)
    `)
    const results: CertAttachment[] = []
    this.db.transaction(() => {
      for (const attachment of attachments) {
        const result = insert.run(attachment.partId, attachment.certId, attachment.stepId, attachment.attachedAt, attachment.attachedBy)
        if (result.changes > 0) {
          results.push({ ...attachment, id: String(result.lastInsertRowid) })
        } else {
          // Already existed (UNIQUE constraint), fetch existing
          const existing = this.db.prepare(
            'SELECT * FROM cert_attachments WHERE part_id = ? AND cert_id = ? AND step_id = ?'
          ).get(attachment.partId, attachment.certId, attachment.stepId) as AttachmentRow
          results.push(attachmentRowToDomain(existing))
        }
      }
    })()
    return results
  }
}
