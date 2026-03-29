import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPartService } from '../../../server/services/partService'
import type { PartIdGenerator } from '../../../server/services/partService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { CertRepository } from '../../../server/repositories/interfaces/certRepository'
import type { AuditService } from '../../../server/services/auditService'
import type { Part, Path, Certificate, ProcessStep } from '../../../server/types/domain'

function makePath(overrides: Partial<Path> & { steps?: ProcessStep[] } = {}): Path {
  return {
    id: 'path_1',
    jobId: 'job_1',
    name: 'Main Route',
    goalQuantity: 10,
    steps: [
      { id: 'step_0', name: 'OP1', order: 0 },
      { id: 'step_1', name: 'OP2', order: 1 },
      { id: 'step_2', name: 'Final', order: 2 },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'part_00001',
    jobId: 'job_1',
    pathId: 'path_1',
    currentStepIndex: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createMockPartRepo(): PartRepository {
  const store = new Map<string, Part>()
  return {
    create: vi.fn((s: Part) => {
      store.set(s.id, s)
      return s
    }),
    createBatch: vi.fn((parts: Part[]) => {
      for (const s of parts) store.set(s.id, s)
      return parts
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    getByIdentifier: vi.fn((id: string) => store.get(id) ?? null),
    listByPathId: vi.fn((pathId: string) => [...store.values()].filter((s) => s.pathId === pathId)),
    listByJobId: vi.fn((jobId: string) => [...store.values()].filter((s) => s.jobId === jobId)),
    listByStepIndex: vi.fn((pathId: string, stepIndex: number) =>
      [...store.values()].filter((s) => s.pathId === pathId && s.currentStepIndex === stepIndex)
    ),
    update: vi.fn((id: string, partial: Partial<Part>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    countByJobId: vi.fn(
      (jobId: string) => [...store.values()].filter((s) => s.jobId === jobId).length
    ),
    countCompletedByJobId: vi.fn(
      (jobId: string) =>
        [...store.values()].filter((s) => s.jobId === jobId && s.currentStepIndex === -1).length
    ),
    countScrappedByJobId: vi.fn(() => 0),
    listAll: vi.fn(() => [...store.values()]),
  }
}

function createMockPathRepo(path: Path | null = makePath()): PathRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(() => path),
    listByJobId: vi.fn(() => (path ? [path] : [])),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

function createMockCertRepo(): CertRepository {
  const certs = new Map<string, Certificate>()
  return {
    create: vi.fn((c: Certificate) => {
      certs.set(c.id, c)
      return c
    }),
    getById: vi.fn((id: string) => certs.get(id) ?? null),
    list: vi.fn(() => [...certs.values()]),
    attachToPart: vi.fn((a) => a),
    getAttachmentsForPart: vi.fn(() => []),
    listAttachmentsByCertId: vi.fn(() => []),
    batchAttach: vi.fn((a) => a),
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
    listAuditEntries: vi.fn(() => []),
    recordPartCreation: vi.fn(() => ({}) as any),
    recordPartAdvancement: vi.fn(() => ({}) as any),
    recordPartCompletion: vi.fn(() => ({}) as any),
    getPartAuditTrail: vi.fn(() => []),
    recordStepSkipped: vi.fn(() => ({}) as any),
    recordStepDeferred: vi.fn(() => ({}) as any),
    recordScrap: vi.fn(() => ({}) as any),
    recordForceComplete: vi.fn(() => ({}) as any),
    recordDeferredStepCompleted: vi.fn(() => ({}) as any),
    recordStepWaived: vi.fn(() => ({}) as any),
    recordStepOverrideCreated: vi.fn(() => ({}) as any),
    recordStepOverrideReversed: vi.fn(() => ({}) as any),
    recordBomEdited: vi.fn(() => ({}) as any),
  }
}

function createMockPartIdGenerator(startAt = 0): PartIdGenerator {
  let counter = startAt
  return {
    next: vi.fn(() => {
      counter++
      return `part_${String(counter).padStart(5, '0')}`
    }),
    nextBatch: vi.fn((count: number) => {
      const ids: string[] = []
      for (let i = 0; i < count; i++) {
        counter++
        ids.push(`part_${String(counter).padStart(5, '0')}`)
      }
      return ids
    }),
  }
}

describe('PartService', () => {
  let partRepo: PartRepository
  let pathRepo: PathRepository
  let certRepo: CertRepository
  let auditService: AuditService
  let partIdGenerator: PartIdGenerator
  let service: ReturnType<typeof createPartService>

  beforeEach(() => {
    partRepo = createMockPartRepo()
    pathRepo = createMockPathRepo()
    certRepo = createMockCertRepo()
    auditService = createMockAuditService()
    partIdGenerator = createMockPartIdGenerator()
    service = createPartService(
      { parts: partRepo, paths: pathRepo, certs: certRepo },
      auditService,
      partIdGenerator
    )
  })

  describe('batchCreateParts', () => {
    it('creates parts with sequential IDs at step 0', () => {
      const result = service.batchCreateParts(
        { jobId: 'job_1', pathId: 'path_1', quantity: 3 },
        'user_1'
      )
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('part_00001')
      expect(result[1].id).toBe('part_00002')
      expect(result[2].id).toBe('part_00003')
      expect(result[0].currentStepIndex).toBe(0)
      expect(result[0].jobId).toBe('job_1')
      expect(result[0].pathId).toBe('path_1')
    })

    it('records audit entry for batch creation', () => {
      service.batchCreateParts({ jobId: 'job_1', pathId: 'path_1', quantity: 5 }, 'user_1')
      expect(auditService.recordPartCreation).toHaveBeenCalledWith({
        userId: 'user_1',
        jobId: 'job_1',
        pathId: 'path_1',
        batchQuantity: 5,
      })
    })

    it('attaches cert to all parts when certId provided', () => {
      // Add a cert to the mock repo
      const cert: Certificate = {
        id: 'cert_1',
        type: 'material',
        name: 'Steel Cert',
        createdAt: '2024-01-01T00:00:00.000Z',
      }
      certRepo.create(cert)

      const result = service.batchCreateParts(
        { jobId: 'job_1', pathId: 'path_1', quantity: 2, certId: 'cert_1' },
        'user_1'
      )
      expect(result).toHaveLength(2)
      expect(certRepo.attachToPart).toHaveBeenCalledTimes(2)
      expect(certRepo.attachToPart).toHaveBeenCalledWith(
        expect.objectContaining({
          partId: 'part_00001',
          certId: 'cert_1',
          stepId: 'step_0',
          attachedBy: 'user_1',
        })
      )
    })

    it('throws NotFoundError when cert does not exist', () => {
      expect(() =>
        service.batchCreateParts(
          { jobId: 'job_1', pathId: 'path_1', quantity: 1, certId: 'nonexistent' },
          'user_1'
        )
      ).toThrow(NotFoundError)
    })

    it('throws ValidationError for quantity of zero', () => {
      expect(() =>
        service.batchCreateParts({ jobId: 'job_1', pathId: 'path_1', quantity: 0 }, 'user_1')
      ).toThrow(ValidationError)
    })

    it('throws ValidationError for negative quantity', () => {
      expect(() =>
        service.batchCreateParts({ jobId: 'job_1', pathId: 'path_1', quantity: -3 }, 'user_1')
      ).toThrow(ValidationError)
    })

    it('throws NotFoundError when path does not exist', () => {
      pathRepo = createMockPathRepo(null)
      service = createPartService(
        { parts: partRepo, paths: pathRepo, certs: certRepo },
        auditService,
        partIdGenerator
      )
      expect(() =>
        service.batchCreateParts({ jobId: 'job_1', pathId: 'missing', quantity: 1 }, 'user_1')
      ).toThrow(NotFoundError)
    })

    it('throws ValidationError when path has no steps', () => {
      pathRepo = createMockPathRepo(makePath({ steps: [] }))
      service = createPartService(
        { parts: partRepo, paths: pathRepo, certs: certRepo },
        auditService,
        partIdGenerator
      )
      expect(() =>
        service.batchCreateParts({ jobId: 'job_1', pathId: 'path_1', quantity: 1 }, 'user_1')
      ).toThrow(ValidationError)
    })
  })

  describe('advancePart', () => {
    it('advances part from step 0 to step 1', () => {
      // Seed a part at step 0
      partRepo.create(makePart({ id: 'part_00001', currentStepIndex: 0 }))

      const result = service.advancePart('part_00001', 'user_1')
      expect(result.currentStepIndex).toBe(1)
    })

    it('records audit entry for advancement', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepIndex: 0 }))

      service.advancePart('part_00001', 'user_1')
      expect(auditService.recordPartAdvancement).toHaveBeenCalledWith({
        userId: 'user_1',
        partId: 'part_00001',
        jobId: 'job_1',
        pathId: 'path_1',
        fromStepId: 'step_0',
        toStepId: 'step_1',
      })
    })

    it('marks part as completed at final step', () => {
      // Path has 3 steps (0, 1, 2), so step 2 is the last
      partRepo.create(makePart({ id: 'part_00001', currentStepIndex: 2 }))

      const result = service.advancePart('part_00001', 'user_1')
      expect(result.currentStepIndex).toBe(-1)
    })

    it('records audit entry for completion', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepIndex: 2 }))

      service.advancePart('part_00001', 'user_1')
      expect(auditService.recordPartCompletion).toHaveBeenCalledWith({
        userId: 'user_1',
        partId: 'part_00001',
        jobId: 'job_1',
        pathId: 'path_1',
        fromStepId: 'step_2',
      })
    })

    it('throws ValidationError when part is already completed', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepIndex: -1, status: 'completed' }))

      expect(() => service.advancePart('part_00001', 'user_1')).toThrow(ValidationError)
    })

    it('throws NotFoundError for missing part', () => {
      expect(() => service.advancePart('nonexistent', 'user_1')).toThrow(NotFoundError)
    })

    it('throws NotFoundError when path is missing', () => {
      partRepo.create(makePart({ id: 'part_00001', pathId: 'missing_path' }))
      pathRepo = createMockPathRepo(null)
      service = createPartService(
        { parts: partRepo, paths: pathRepo, certs: certRepo },
        auditService,
        partIdGenerator
      )

      expect(() => service.advancePart('part_00001', 'user_1')).toThrow(NotFoundError)
    })
  })

  describe('getPart', () => {
    it('returns existing part', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const result = service.getPart('part_00001')
      expect(result.id).toBe('part_00001')
    })

    it('throws NotFoundError for missing part', () => {
      expect(() => service.getPart('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('lookupPart', () => {
    it('returns part when found', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const result = service.lookupPart('part_00001')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('part_00001')
    })

    it('returns null when not found', () => {
      const result = service.lookupPart('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('listPartsByPath', () => {
    it('returns parts for a path', () => {
      partRepo.create(makePart({ id: 'part_00001', pathId: 'path_1' }))
      partRepo.create(makePart({ id: 'part_00002', pathId: 'path_1' }))
      partRepo.create(makePart({ id: 'part_00003', pathId: 'path_2' }))

      const result = service.listPartsByPath('path_1')
      expect(result).toHaveLength(2)
    })
  })

  describe('listPartsByJob', () => {
    it('returns parts for a job', () => {
      partRepo.create(makePart({ id: 'part_00001', jobId: 'job_1' }))
      partRepo.create(makePart({ id: 'part_00002', jobId: 'job_1' }))
      partRepo.create(makePart({ id: 'part_00003', jobId: 'job_2' }))

      const result = service.listPartsByJob('job_1')
      expect(result).toHaveLength(2)
    })
  })

  describe('listPartsByStepIndex', () => {
    it('returns parts at a specific step', () => {
      partRepo.create(makePart({ id: 'part_00001', pathId: 'path_1', currentStepIndex: 0 }))
      partRepo.create(makePart({ id: 'part_00002', pathId: 'path_1', currentStepIndex: 1 }))
      partRepo.create(makePart({ id: 'part_00003', pathId: 'path_1', currentStepIndex: 0 }))

      const result = service.listPartsByStepIndex('path_1', 0)
      expect(result).toHaveLength(2)
    })
  })
})
