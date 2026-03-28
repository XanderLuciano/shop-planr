import type { Certificate, CertAttachment } from '../../types/domain'

export interface CertRepository {
  create(cert: Certificate): Certificate
  getById(id: string): Certificate | null
  list(): Certificate[]
  attachToPart(attachment: CertAttachment): CertAttachment
  /** @deprecated Use `attachToPart` instead. */
  attachToSerial?: (attachment: CertAttachment) => CertAttachment
  getAttachmentsForPart(partId: string): CertAttachment[]
  /** @deprecated Use `getAttachmentsForPart` instead. */
  getAttachmentsForSerial?: (serialId: string) => CertAttachment[]
  listAttachmentsByCertId(certId: string): CertAttachment[]
  batchAttach(attachments: CertAttachment[]): CertAttachment[]
}
