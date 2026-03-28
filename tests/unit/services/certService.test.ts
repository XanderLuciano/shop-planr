import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCertService } from '../../../server/services/certService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { CertRepository } from '../../../server/repositories/interfaces/certRepository'
import type { AuditService } from '../../../server/services/auditService'
import type { Certificate, CertAttachment } from '../../../server/types/domain'

function makeCert(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 'cert_1',
    type: 'material',
    name: 'Steel Cert',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createMockCertRepo(): CertRepository {
  const certs = new Map<string, Certificate>()
  const attachments: CertAttachment[] = []

  return {
    create: vi.fn((c: Certificate) => { certs.set(c.id, c); return c }),
    getById: vi.fn((id: string) => certs.get(id) ?? null),
    list: vi.fn(() => [...certs.values()]),
    attachToPart: vi.fn((a: CertAttachment) => {
      const result = { ...a, id: String(attachments.length + 1) }
      attachments.push(result)
      return result
    }),
    getAttachmentsForPart: vi.fn((partId: string) =>
      attachments.filter(a => a.partId === partId)
    ),
    batchAttach: vi.fn((incoming: CertAttachment[]) => {
      const results: CertAttachment[] = []
      for (const a of incoming) {
        const result = { ...a, id: String(attachments.length + 1) }
        attachments.push(result)
        results.push(result)
      }
      return results
    })
  }
}

function createMockAuditService(): AuditService {
  return {
    recordCertAttachment: vi.fn(() => ({}) as any),
    recordPartCreation: vi.fn(() => ({}) as any),
    recordPartAdvancement: vi.fn(() => ({}) as any),
    recordPartCompletion: vi.fn(() => ({}) as any),
    recordNoteCreation: vi.fn(() => ({}) as any),
    getPartAuditTrail: vi.fn(() => []),
    getJobAuditTrail: vi.fn(() => []),
    listAuditEntries: vi.fn(() => [])
  }
}

describe('CertService', () => {
  let certRepo: CertRepository
  let auditService: AuditService
  let service: ReturnType<typeof createCertService>

  beforeEach(() => {
    certRepo = createMockCertRepo()
    auditService = createMockAuditService()
    service = createCertService({ certs: certRepo }, auditService)
  })

  describe('createCert', () => {
    it('creates a material certificate', () => {
      const result = service.createCert({ type: 'material', name: 'Steel Cert' })
      expect(result.type).toBe('material')
      expect(result.name).toBe('Steel Cert')
      expect(result.id).toMatch(/^cert_/)
      expect(result.createdAt).toBeDefined()
    })

    it('creates a process certificate', () => {
      const result = service.createCert({ type: 'process', name: 'Heat Treat' })
      expect(result.type).toBe('process')
      expect(result.name).toBe('Heat Treat')
    })

    it('stores metadata when provided', () => {
      const result = service.createCert({
        type: 'material',
        name: 'Alloy Cert',
        metadata: { grade: 'A36', vendor: 'Acme' }
      })
      expect(result.metadata).toEqual({ grade: 'A36', vendor: 'Acme' })
    })

    it('throws ValidationError for invalid type', () => {
      expect(() =>
        service.createCert({ type: 'invalid' as any, name: 'Bad Cert' })
      ).toThrow(ValidationError)
    })

    it('throws ValidationError for empty name', () => {
      expect(() =>
        service.createCert({ type: 'material', name: '' })
      ).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() =>
        service.createCert({ type: 'material', name: '   ' })
      ).toThrow(ValidationError)
    })
  })

  describe('getCert', () => {
    it('returns existing certificate', () => {
      certRepo.create(makeCert({ id: 'cert_1' }))
      const result = service.getCert('cert_1')
      expect(result.id).toBe('cert_1')
    })

    it('throws NotFoundError for missing certificate', () => {
      expect(() => service.getCert('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listCerts', () => {
    it('returns all certificates', () => {
      certRepo.create(makeCert({ id: 'cert_1' }))
      certRepo.create(makeCert({ id: 'cert_2', name: 'Process Cert' }))
      const result = service.listCerts()
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no certs exist', () => {
      const result = service.listCerts()
      expect(result).toEqual([])
    })
  })

  describe('attachCertToPart', () => {
    it('attaches cert and records audit', () => {
      certRepo.create(makeCert({ id: 'cert_1' }))

      const result = service.attachCertToPart({
        certId: 'cert_1',
        partId: 'part_00001',
        stepId: 'step_0',
        userId: 'user_1',
        jobId: 'job_1',
        pathId: 'path_1'
      })

      expect(result.partId).toBe('part_00001')
      expect(result.certId).toBe('cert_1')
      expect(result.stepId).toBe('step_0')
      expect(result.attachedBy).toBe('user_1')
      expect(certRepo.attachToPart).toHaveBeenCalledTimes(1)
      expect(auditService.recordCertAttachment).toHaveBeenCalledWith({
        userId: 'user_1',
        partId: 'part_00001',
        certId: 'cert_1',
        stepId: 'step_0',
        jobId: 'job_1',
        pathId: 'path_1'
      })
    })

    it('throws NotFoundError when cert does not exist', () => {
      expect(() =>
        service.attachCertToPart({
          certId: 'nonexistent',
          partId: 'part_00001',
          stepId: 'step_0',
          userId: 'user_1'
        })
      ).toThrow(NotFoundError)
    })
  })

  describe('batchAttachCert', () => {
    it('attaches cert to multiple parts and records audit for each', () => {
      certRepo.create(makeCert({ id: 'cert_1' }))

      const result = service.batchAttachCert({
        certId: 'cert_1',
        partIds: ['part_00001', 'part_00002', 'part_00003'],
        userId: 'user_1'
      })

      expect(result).toHaveLength(3)
      expect(certRepo.batchAttach).toHaveBeenCalledTimes(1)
      expect(auditService.recordCertAttachment).toHaveBeenCalledTimes(3)
    })

    it('throws NotFoundError when cert does not exist', () => {
      expect(() =>
        service.batchAttachCert({
          certId: 'nonexistent',
          partIds: ['part_00001'],
          userId: 'user_1'
        })
      ).toThrow(NotFoundError)
    })
  })

  describe('getCertsForPart', () => {
    it('returns attachments for a part', () => {
      certRepo.create(makeCert({ id: 'cert_1' }))
      service.attachCertToPart({
        certId: 'cert_1',
        partId: 'part_00001',
        stepId: 'step_0',
        userId: 'user_1'
      })

      const result = service.getCertsForPart('part_00001')
      expect(result).toHaveLength(1)
      expect(result[0].certId).toBe('cert_1')
    })

    it('returns empty array when no attachments exist', () => {
      const result = service.getCertsForPart('part_99999')
      expect(result).toEqual([])
    })
  })
})
