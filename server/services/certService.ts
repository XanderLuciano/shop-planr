import type { CertRepository } from '../repositories/interfaces/certRepository'
import type { Certificate, CertAttachment } from '../types/domain'
import type { CreateCertInput, BatchAttachCertInput } from '../types/api'
import type { AuditService } from '../services/auditService'
import { assertOneOf, assertNonEmpty } from '../utils/validation'
import { NotFoundError } from '../utils/errors'
import { generateId } from '../utils/idGenerator'

export function createCertService(repos: { certs: CertRepository }, auditService: AuditService) {
  return {
    createCert(input: CreateCertInput): Certificate {
      assertOneOf(input.type, ['material', 'process'] as const, 'type')
      assertNonEmpty(input.name, 'name')

      const cert: Certificate = {
        id: generateId('cert'),
        type: input.type,
        name: input.name,
        metadata: input.metadata,
        createdAt: new Date().toISOString(),
      }

      return repos.certs.create(cert)
    },

    getCert(id: string): Certificate {
      const cert = repos.certs.getById(id)
      if (!cert) {
        throw new NotFoundError('Certificate', id)
      }
      return cert
    },

    listCerts(): Certificate[] {
      return repos.certs.list()
    },

    attachCertToPart(params: {
      certId: string
      partId: string
      stepId: string
      userId: string
      jobId?: string
      pathId?: string
    }): CertAttachment {
      const cert = repos.certs.getById(params.certId)
      if (!cert) {
        throw new NotFoundError('Certificate', params.certId)
      }

      const now = new Date().toISOString()
      const attachment = repos.certs.attachToPart({
        partId: params.partId,
        certId: params.certId,
        stepId: params.stepId,
        attachedAt: now,
        attachedBy: params.userId,
      })

      auditService.recordCertAttachment({
        userId: params.userId,
        partId: params.partId,
        certId: params.certId,
        stepId: params.stepId,
        jobId: params.jobId,
        pathId: params.pathId,
      })

      return attachment
    },

    /** @deprecated Use `attachCertToPart` instead. */
    attachCertToSerial(params: {
      certId: string
      serialId: string
      stepId: string
      userId: string
      jobId?: string
      pathId?: string
    }): CertAttachment {
      return this.attachCertToPart({
        ...params,
        partId: params.serialId,
      })
    },

    batchAttachCert(input: BatchAttachCertInput): CertAttachment[] {
      const cert = repos.certs.getById(input.certId)
      if (!cert) {
        throw new NotFoundError('Certificate', input.certId)
      }

      const now = new Date().toISOString()
      const attachments: CertAttachment[] = input.partIds.map((partId) => ({
        partId,
        certId: input.certId,
        stepId: '',
        attachedAt: now,
        attachedBy: input.userId,
      }))

      const results = repos.certs.batchAttach(attachments)

      // Record audit for each new attachment
      for (const attachment of results) {
        auditService.recordCertAttachment({
          userId: input.userId,
          partId: attachment.partId,
          certId: input.certId,
          stepId: attachment.stepId,
        })
      }

      return results
    },

    getCertsForPart(partId: string): CertAttachment[] {
      return repos.certs.getAttachmentsForPart(partId)
    },

    /** @deprecated Use `getCertsForPart` instead. */
    getCertsForSerial(serialId: string): CertAttachment[] {
      return this.getCertsForPart(serialId)
    },

    getAttachmentsByPartId(partId: string): CertAttachment[] {
      return repos.certs.getAttachmentsForPart(partId)
    },

    /** @deprecated Use `getAttachmentsByPartId` instead. */
    getAttachmentsBySerialId(serialId: string): CertAttachment[] {
      return this.getAttachmentsByPartId(serialId)
    },

    getAttachmentsByCertId(certId: string): CertAttachment[] {
      return repos.certs.listAttachmentsByCertId(certId)
    },
  }
}

export type CertService = ReturnType<typeof createCertService>
