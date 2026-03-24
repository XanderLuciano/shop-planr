import type { Certificate, CertAttachment } from '../../types/domain'

export interface CertRepository {
  create(cert: Certificate): Certificate
  getById(id: string): Certificate | null
  list(): Certificate[]
  attachToSerial(attachment: CertAttachment): CertAttachment
  getAttachmentsForSerial(serialId: string): CertAttachment[]
  listAttachmentsByCertId(certId: string): CertAttachment[]
  batchAttach(attachments: CertAttachment[]): CertAttachment[]
}
