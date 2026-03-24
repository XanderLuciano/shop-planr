import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSerialService } from '../../../server/services/serialService'
import type { SnGenerator } from '../../../server/services/serialService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { SerialRepository } from '../../../server/repositories/interfaces/serialRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { CertRepository } from '../../../server/repositories/interfaces/certRepository'
import type { AuditService } from '../../../server/services/auditService'
import type { SerialNumber, Path, Certificate, ProcessStep } from '../../../server/types/domain'

function makePath(overrides: Partial<Path> & { steps?: ProcessStep[] } = {}): Path {
  return {
    id: 'path_1',
    jobId: 'job_1',
    name: 'Main Route',
    goalQuantity: 10,
    steps: [
      { id: 'step_0', name: 'OP1', order: 0 },
      { id: 'step_1', name: 'OP2', order: 1 },
      { id: 'step_2', name: 'Final', order: 2 }
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

function makeSerial(overrides: Partial<SerialNumber> = {}): SerialNumber {
  return {
    id: 'SN-00001',
    jobId: 'job_1',
    pathId: 'path_1',
    currentStepIndex: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createMockSerialRepo(): SerialRepository {
  const store = new Map<string, SerialNumber>()
  return {
    create: vi.fn((s: SerialNumber) => { store.set(s.id, s); return s }),
    createBatch: vi.fn((serials: SerialNumber[]) => {
      for (const s of serials) store.set(s.id, s)
      return serials
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    getByIdentifier: vi.fn((id: string) => store.get(id) ?? null),
    listByPathId: vi.fn((pathId: string) => [...store.values()].filter(s => s.pathId === pathId)),
    listByJobId: vi.fn((jobId: string) => [...store.values()].filter(s => s.jobId === jobId)),
    listByStepIndex: vi.fn((pathId: string, stepIndex: number) =>
      [...store.values()].filter(s => s.pathId === pathId && s.currentStepIndex === stepIndex)
    ),
    update: vi.fn((id: string, partial: Partial<SerialNumber>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    countByJobId: vi.fn((jobId: string) => [...store.values()].filter(s => s.jobId === jobId).length),
    countCompletedByJobId: vi.fn((jobId: string) =>
      [...store.values()].filter(s => s.jobId === jobId && s.currentStepIndex === -1).length
    )
  }
}

function createMockPathRepo(path: Path | null = makePath()): PathRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(() => path),
    listByJobId: vi.fn(() => path ? [path] : []),
    update: vi.fn(),
    delete: vi.fn()
  }
}

function createMockCertRepo(): CertRepository {
  const certs = new Map<string, Certificate>()
  return {
    create: vi.fn((c: Certificate) => { certs.set(c.id, c); return c }),
    getById: vi.fn((id: string) => certs.get(id) ?? null),
    list: vi.fn(() => [...certs.values()]),
    attachToSerial: vi.fn(a => a),
    getAttachmentsForSerial: vi.fn(() => []),
    batchAttach: vi.fn(a => a)
  }
}

function createMockAuditService(): AuditService {
  return {
    recordCertAttachment: vi.fn(() => ({} as any)),
    recordSerialCreation: vi.fn(() => ({} as any)),
    recordSerialAdvancement: vi.fn(() => ({} as any)),
    recordSerialCompletion: vi.fn(() => ({} as any)),
    recordNoteCreation: vi.fn(() => ({} as any)),
    getSerialAuditTrail: vi.fn(() => []),
    getJobAuditTrail: vi.fn(() => []),
    listAuditEntries: vi.fn(() => [])
  }
}

function createMockSnGenerator(startAt = 0): SnGenerator {
  let counter = startAt
  return {
    next: vi.fn(() => {
      counter++
      return `SN-${String(counter).padStart(5, '0')}`
    }),
    nextBatch: vi.fn((count: number) => {
      const ids: string[] = []
      for (let i = 0; i < count; i++) {
        counter++
        ids.push(`SN-${String(counter).padStart(5, '0')}`)
      }
      return ids
    })
  }
}

describe('SerialService', () => {
  let serialRepo: SerialRepository
  let pathRepo: PathRepository
  let certRepo: CertRepository
  let auditService: AuditService
  let snGenerator: SnGenerator
  let service: ReturnType<typeof createSerialService>

  beforeEach(() => {
    serialRepo = createMockSerialRepo()
    pathRepo = createMockPathRepo()
    certRepo = createMockCertRepo()
    auditService = createMockAuditService()
    snGenerator = createMockSnGenerator()
    service = createSerialService(
      { serials: serialRepo, paths: pathRepo, certs: certRepo },
      auditService,
      snGenerator
    )
  })

  describe('batchCreateSerials', () => {
    it('creates serials with sequential IDs at step 0', () => {
      const result = service.batchCreateSerials(
        { jobId: 'job_1', pathId: 'path_1', quantity: 3 },
        'user_1'
      )
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('SN-00001')
      expect(result[1].id).toBe('SN-00002')
      expect(result[2].id).toBe('SN-00003')
      expect(result[0].currentStepIndex).toBe(0)
      expect(result[0].jobId).toBe('job_1')
      expect(result[0].pathId).toBe('path_1')
    })

    it('records audit entry for batch creation', () => {
      service.batchCreateSerials(
        { jobId: 'job_1', pathId: 'path_1', quantity: 5 },
        'user_1'
      )
      expect(auditService.recordSerialCreation).toHaveBeenCalledWith({
        userId: 'user_1',
        jobId: 'job_1',
        pathId: 'path_1',
        batchQuantity: 5
      })
    })

    it('attaches cert to all serials when certId provided', () => {
      // Add a cert to the mock repo
      const cert: Certificate = {
        id: 'cert_1',
        type: 'material',
        name: 'Steel Cert',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
      certRepo.create(cert)

      const result = service.batchCreateSerials(
        { jobId: 'job_1', pathId: 'path_1', quantity: 2, certId: 'cert_1' },
        'user_1'
      )
      expect(result).toHaveLength(2)
      expect(certRepo.attachToSerial).toHaveBeenCalledTimes(2)
      expect(certRepo.attachToSerial).toHaveBeenCalledWith(
        expect.objectContaining({
          serialId: 'SN-00001',
          certId: 'cert_1',
          stepId: 'step_0',
          attachedBy: 'user_1'
        })
      )
    })

    it('throws NotFoundError when cert does not exist', () => {
      expect(() =>
        service.batchCreateSerials(
          { jobId: 'job_1', pathId: 'path_1', quantity: 1, certId: 'nonexistent' },
          'user_1'
        )
      ).toThrow(NotFoundError)
    })

    it('throws ValidationError for quantity of zero', () => {
      expect(() =>
        service.batchCreateSerials(
          { jobId: 'job_1', pathId: 'path_1', quantity: 0 },
          'user_1'
        )
      ).toThrow(ValidationError)
    })

    it('throws ValidationError for negative quantity', () => {
      expect(() =>
        service.batchCreateSerials(
          { jobId: 'job_1', pathId: 'path_1', quantity: -3 },
          'user_1'
        )
      ).toThrow(ValidationError)
    })

    it('throws NotFoundError when path does not exist', () => {
      pathRepo = createMockPathRepo(null)
      service = createSerialService(
        { serials: serialRepo, paths: pathRepo, certs: certRepo },
        auditService,
        snGenerator
      )
      expect(() =>
        service.batchCreateSerials(
          { jobId: 'job_1', pathId: 'missing', quantity: 1 },
          'user_1'
        )
      ).toThrow(NotFoundError)
    })

    it('throws ValidationError when path has no steps', () => {
      pathRepo = createMockPathRepo(makePath({ steps: [] }))
      service = createSerialService(
        { serials: serialRepo, paths: pathRepo, certs: certRepo },
        auditService,
        snGenerator
      )
      expect(() =>
        service.batchCreateSerials(
          { jobId: 'job_1', pathId: 'path_1', quantity: 1 },
          'user_1'
        )
      ).toThrow(ValidationError)
    })
  })

  describe('advanceSerial', () => {
    it('advances serial from step 0 to step 1', () => {
      // Seed a serial at step 0
      serialRepo.create(makeSerial({ id: 'SN-00001', currentStepIndex: 0 }))

      const result = service.advanceSerial('SN-00001', 'user_1')
      expect(result.currentStepIndex).toBe(1)
    })

    it('records audit entry for advancement', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', currentStepIndex: 0 }))

      service.advanceSerial('SN-00001', 'user_1')
      expect(auditService.recordSerialAdvancement).toHaveBeenCalledWith({
        userId: 'user_1',
        serialId: 'SN-00001',
        jobId: 'job_1',
        pathId: 'path_1',
        fromStepId: 'step_0',
        toStepId: 'step_1'
      })
    })

    it('marks serial as completed at final step', () => {
      // Path has 3 steps (0, 1, 2), so step 2 is the last
      serialRepo.create(makeSerial({ id: 'SN-00001', currentStepIndex: 2 }))

      const result = service.advanceSerial('SN-00001', 'user_1')
      expect(result.currentStepIndex).toBe(-1)
    })

    it('records audit entry for completion', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', currentStepIndex: 2 }))

      service.advanceSerial('SN-00001', 'user_1')
      expect(auditService.recordSerialCompletion).toHaveBeenCalledWith({
        userId: 'user_1',
        serialId: 'SN-00001',
        jobId: 'job_1',
        pathId: 'path_1',
        fromStepId: 'step_2'
      })
    })

    it('throws ValidationError when serial is already completed', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', currentStepIndex: -1 }))

      expect(() => service.advanceSerial('SN-00001', 'user_1')).toThrow(ValidationError)
    })

    it('throws NotFoundError for missing serial', () => {
      expect(() => service.advanceSerial('nonexistent', 'user_1')).toThrow(NotFoundError)
    })

    it('throws NotFoundError when path is missing', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', pathId: 'missing_path' }))
      pathRepo = createMockPathRepo(null)
      service = createSerialService(
        { serials: serialRepo, paths: pathRepo, certs: certRepo },
        auditService,
        snGenerator
      )

      expect(() => service.advanceSerial('SN-00001', 'user_1')).toThrow(NotFoundError)
    })
  })

  describe('getSerial', () => {
    it('returns existing serial', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001' }))
      const result = service.getSerial('SN-00001')
      expect(result.id).toBe('SN-00001')
    })

    it('throws NotFoundError for missing serial', () => {
      expect(() => service.getSerial('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('lookupSerial', () => {
    it('returns serial when found', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001' }))
      const result = service.lookupSerial('SN-00001')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('SN-00001')
    })

    it('returns null when not found', () => {
      const result = service.lookupSerial('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('listSerialsByPath', () => {
    it('returns serials for a path', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', pathId: 'path_1' }))
      serialRepo.create(makeSerial({ id: 'SN-00002', pathId: 'path_1' }))
      serialRepo.create(makeSerial({ id: 'SN-00003', pathId: 'path_2' }))

      const result = service.listSerialsByPath('path_1')
      expect(result).toHaveLength(2)
    })
  })

  describe('listSerialsByJob', () => {
    it('returns serials for a job', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', jobId: 'job_1' }))
      serialRepo.create(makeSerial({ id: 'SN-00002', jobId: 'job_1' }))
      serialRepo.create(makeSerial({ id: 'SN-00003', jobId: 'job_2' }))

      const result = service.listSerialsByJob('job_1')
      expect(result).toHaveLength(2)
    })
  })

  describe('listSerialsByStepIndex', () => {
    it('returns serials at a specific step', () => {
      serialRepo.create(makeSerial({ id: 'SN-00001', pathId: 'path_1', currentStepIndex: 0 }))
      serialRepo.create(makeSerial({ id: 'SN-00002', pathId: 'path_1', currentStepIndex: 1 }))
      serialRepo.create(makeSerial({ id: 'SN-00003', pathId: 'path_1', currentStepIndex: 0 }))

      const result = service.listSerialsByStepIndex('path_1', 0)
      expect(result).toHaveLength(2)
    })
  })
})
