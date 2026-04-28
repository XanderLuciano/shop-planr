import type { CertRepository } from '../repositories/interfaces/certRepository'
import type { Certificate, CertAttachment } from '../types/domain'
import type { CreateCertInput, BatchAttachCertInput } from '../types/api'
import type { AuditService } from '../services/auditService'
import { assertOneOf, assertNonEmpty } from '../utils/validation'
import { NotFoundError } from '../utils/errors'
import { generateId } from '../utils/idGenerator'

export function createCertService(
  repos: { certs: CertRepository },
  auditService: AuditService,
) {
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

    /** @deprecated Use `batchAttachCertWithSteps` instead — this method sets stepId to empty string which violates the FK constraint. */
    batchAttachCert(input: BatchAttachCertInput): CertAttachment[] {
      return this.batchAttachCertWithSteps({
        certId: input.certId,
        attachments: input.partIds.map(partId => ({ partId, stepId: '' })),
        userId: input.userId,
      })
    },

    batchAttachCertWithSteps(input: {
      certId: string
      attachments: readonly { partId: string, stepId: string, jobId?: string, pathId?: string }[]
      userId: string
    }): CertAttachment[] {
      const cert = repos.certs.getById(input.certId)
      if (!cert) {
        throw new NotFoundError('Certificate', input.certId)
      }

      const now = new Date().toISOString()
      const rows: CertAttachment[] = input.attachments.map(a => ({
        partId: a.partId,
        certId: input.certId,
        stepId: a.stepId,
        attachedAt: now,
        attachedBy: input.userId,
      }))

      const results = repos.certs.batchAttach(rows)

      // Build a lookup from partId to source attachment for audit enrichment
      const sourceByPartId = new Map(
        input.attachments.map(a => [a.partId, a]),
      )

      for (const result of results) {
        const source = sourceByPartId.get(result.partId)
        auditService.recordCertAttachment({
          userId: input.userId,
          partId: result.partId,
          certId: input.certId,
          stepId: result.stepId,
          jobId: source?.jobId,
          pathId: source?.pathId,
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
