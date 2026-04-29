import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPartService } from '../../../server/services/partService'
import type { PartIdGenerator } from '../../../server/services/partService'
import { NotFoundError, ValidationError, ForbiddenError } from '../../../server/utils/errors'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { CertRepository } from '../../../server/repositories/interfaces/certRepository'
import type { UserRepository } from '../../../server/repositories/interfaces/userRepository'
import type { PartStepStatusRepository } from '../../../server/repositories/interfaces/partStepStatusRepository'
import type { PartStepOverrideRepository } from '../../../server/repositories/interfaces/partStepOverrideRepository'
import type { AuditService } from '../../../server/services/auditService'
import type { Part, Path, Certificate, ProcessStep, ShopUser } from '../../../server/types/domain'

function makePath(overrides: Partial<Path> & { steps?: ProcessStep[] } = {}): Path {
  return {
    id: 'path_1',
    jobId: 'job_1',
    name: 'Main Route',
    goalQuantity: 10,
    steps: [
      { id: 'step_0', name: 'OP1', order: 0, optional: false, dependencyType: 'preferred', completedCount: 0 },
      { id: 'step_1', name: 'OP2', order: 1, optional: false, dependencyType: 'preferred', completedCount: 0 },
      { id: 'step_2', name: 'Final', order: 2, optional: false, dependencyType: 'preferred', completedCount: 0 },
    ],
    advancementMode: 'strict',
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
    currentStepId: 'step_0',
    status: 'in_progress',
    forceCompleted: false,
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
    listByPathId: vi.fn((pathId: string) => [...store.values()].filter(s => s.pathId === pathId)),
    listByJobId: vi.fn((jobId: string) => [...store.values()].filter(s => s.jobId === jobId)),
    listByCurrentStepId: vi.fn((stepId: string) =>
      [...store.values()].filter(s => s.currentStepId === stepId && s.status !== 'scrapped'),
    ),
    update: vi.fn((id: string, partial: Partial<Part>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    countByJobId: vi.fn((jobId: string) => [...store.values()].filter(s => s.jobId === jobId).length),
    countCompletedByJobId: vi.fn((jobId: string) =>
      [...store.values()].filter(s => s.jobId === jobId && s.currentStepId === null && s.status === 'completed').length,
    ),
    countScrappedByJobId: vi.fn(() => 0),
    countsByJob: vi.fn(() => new Map()),
    listAll: vi.fn(() => [...store.values()]),
    listAllEnriched: vi.fn(() => []),
    deleteByPathId: vi.fn((pathId: string) => {
      let count = 0
      for (const [id, p] of store) {
        if (p.pathId === pathId) {
          store.delete(id)
          count++
        }
      }
      return count
    }),
    delete: vi.fn((id: string) => {
      if (!store.has(id)) {
        throw new NotFoundError('Part', id)
      }
      store.delete(id)
    }),
  }
}

function createMockPathRepo(path: Path | null = makePath()): PathRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(() => path),
    listByJobId: vi.fn(() => path ? [path] : []),
    update: vi.fn(),
    delete: vi.fn(),
    updateStep: vi.fn((_id: string, _partial: any) => ({})),
    getStepById: vi.fn(),
    updateStepAssignment: vi.fn(),
    getStepByIdIncludeRemoved: vi.fn(),
  } as unknown as PathRepository
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
    attachToPart: vi.fn(a => a),
    getAttachmentsForPart: vi.fn(() => []),
    listAttachmentsByCertId: vi.fn(() => []),
    batchAttach: vi.fn(a => a),
    deleteAttachmentsByPartIds: vi.fn(() => 0),
  } as unknown as CertRepository
}

function createMockUserRepo(users: ShopUser[] = []): UserRepository {
  const store = new Map<string, ShopUser>(users.map(u => [u.id, u]))
  return {
    getById: vi.fn((id: string) => store.get(id) ?? null),
  } as unknown as UserRepository
}

function createMockPartStepStatusRepo(): PartStepStatusRepository {
  return {
    deleteByPartIds: vi.fn(() => 0),
  } as unknown as PartStepStatusRepository
}

function createMockPartStepOverrideRepo(): PartStepOverrideRepository {
  return {
    deleteByPartIds: vi.fn(() => 0),
  } as unknown as PartStepOverrideRepository
}

/** Minimal fake better-sqlite3 Database — only `transaction` is used by partService. */
function createMockDb(): any {
  return {
    transaction: (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => fn(...args),
  }
}

function makeAdminUser(overrides: Partial<ShopUser> = {}): ShopUser {
  return {
    id: 'admin_1',
    username: 'admin',
    displayName: 'Admin User',
    isAdmin: true,
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createMockAuditService(): AuditService {
  return {
    recordCertAttachment: vi.fn(() => ({} as any)),
    recordPartCreation: vi.fn(() => ({} as any)),
    recordPartAdvancement: vi.fn(() => ({} as any)),
    recordPartCompletion: vi.fn(() => ({} as any)),
    recordNoteCreation: vi.fn(() => ({} as any)),
    getPartAuditTrail: vi.fn(() => []),
    getJobAuditTrail: vi.fn(() => []),
    listAuditEntries: vi.fn(() => []),
    recordStepSkipped: vi.fn(() => ({} as any)),
    recordStepDeferred: vi.fn(() => ({} as any)),
    recordScrap: vi.fn(() => ({} as any)),
    recordForceComplete: vi.fn(() => ({} as any)),
    recordDeferredStepCompleted: vi.fn(() => ({} as any)),
    recordStepWaived: vi.fn(() => ({} as any)),
    recordStepOverrideCreated: vi.fn(() => ({} as any)),
    recordStepOverrideReversed: vi.fn(() => ({} as any)),
    recordBomEdited: vi.fn(() => ({} as any)),
    recordPathDeletion: vi.fn(() => ({} as any)),
    recordPartDeletion: vi.fn(() => ({} as any)),
  } as unknown as AuditService
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
      partIdGenerator,
    )
  })

  describe('batchCreateParts', () => {
    it('creates parts with sequential IDs at first step', () => {
      const result = service.batchCreateParts(
        { jobId: 'job_1', pathId: 'path_1', quantity: 3 },
        'user_1',
      )
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('part_00001')
      expect(result[1].id).toBe('part_00002')
      expect(result[2].id).toBe('part_00003')
      expect(result[0].currentStepId).toBe('step_0')
      expect(result[0].jobId).toBe('job_1')
      expect(result[0].pathId).toBe('path_1')
    })

    it('records audit entry for batch creation', () => {
      service.batchCreateParts(
        { jobId: 'job_1', pathId: 'path_1', quantity: 5 },
        'user_1',
      )
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
        'user_1',
      )
      expect(result).toHaveLength(2)
      expect(certRepo.attachToPart).toHaveBeenCalledTimes(2)
      expect(certRepo.attachToPart).toHaveBeenCalledWith(
        expect.objectContaining({
          partId: 'part_00001',
          certId: 'cert_1',
          stepId: 'step_0',
          attachedBy: 'user_1',
        }),
      )
    })

    it('throws NotFoundError when cert does not exist', () => {
      expect(() =>
        service.batchCreateParts(
          { jobId: 'job_1', pathId: 'path_1', quantity: 1, certId: 'nonexistent' },
          'user_1',
        ),
      ).toThrow(NotFoundError)
    })

    it('throws ValidationError for quantity of zero', () => {
      expect(() =>
        service.batchCreateParts(
          { jobId: 'job_1', pathId: 'path_1', quantity: 0 },
          'user_1',
        ),
      ).toThrow(ValidationError)
    })

    it('throws ValidationError for negative quantity', () => {
      expect(() =>
        service.batchCreateParts(
          { jobId: 'job_1', pathId: 'path_1', quantity: -3 },
          'user_1',
        ),
      ).toThrow(ValidationError)
    })

    it('throws NotFoundError when path does not exist', () => {
      pathRepo = createMockPathRepo(null)
      service = createPartService(
        { parts: partRepo, paths: pathRepo, certs: certRepo },
        auditService,
        partIdGenerator,
      )
      expect(() =>
        service.batchCreateParts(
          { jobId: 'job_1', pathId: 'missing', quantity: 1 },
          'user_1',
        ),
      ).toThrow(NotFoundError)
    })

    it('throws ValidationError when path has no steps', () => {
      pathRepo = createMockPathRepo(makePath({ steps: [] }))
      service = createPartService(
        { parts: partRepo, paths: pathRepo, certs: certRepo },
        auditService,
        partIdGenerator,
      )
      expect(() =>
        service.batchCreateParts(
          { jobId: 'job_1', pathId: 'path_1', quantity: 1 },
          'user_1',
        ),
      ).toThrow(ValidationError)
    })
  })

  describe('advancePart', () => {
    it('advances part from step 0 to step 1', () => {
      // Seed a part at step 0
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_0' }))

      const result = service.advancePart('part_00001', 'user_1')
      expect(result.currentStepId).toBe('step_1')
    })

    it('records audit entry for advancement', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_0' }))

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
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_2' }))

      const result = service.advancePart('part_00001', 'user_1')
      expect(result.currentStepId).toBeNull()
    })

    it('records audit entry for completion', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_2' }))

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
      partRepo.create(makePart({ id: 'part_00001', currentStepId: null, status: 'completed' }))

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
        partIdGenerator,
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

  describe('listPartsByCurrentStepId', () => {
    it('returns parts at a specific step', () => {
      partRepo.create(makePart({ id: 'part_00001', pathId: 'path_1', currentStepId: 'step_0' }))
      partRepo.create(makePart({ id: 'part_00002', pathId: 'path_1', currentStepId: 'step_1' }))
      partRepo.create(makePart({ id: 'part_00003', pathId: 'path_1', currentStepId: 'step_0' }))

      const result = service.listPartsByCurrentStepId('step_0')
      expect(result).toHaveLength(2)
    })
  })

  describe('batchAdvanceParts', () => {
    it('returns all succeeded when every part advances', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_0' }))
      partRepo.create(makePart({ id: 'part_00002', currentStepId: 'step_0' }))
      partRepo.create(makePart({ id: 'part_00003', currentStepId: 'step_0' }))

      const result = service.batchAdvanceParts(
        ['part_00001', 'part_00002', 'part_00003'],
        'user_1',
      )

      expect(result.advanced).toBe(3)
      expect(result.failed).toBe(0)
      expect(result.results).toHaveLength(3)
      expect(result.results.every(r => r.success)).toBe(true)
    })

    it('handles partial failure when some parts are not found or already completed', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_0' }))
      partRepo.create(makePart({ id: 'part_00002', currentStepId: null, status: 'completed' }))
      // part_00003 does not exist

      const result = service.batchAdvanceParts(
        ['part_00001', 'part_00002', 'part_00003'],
        'user_1',
      )

      expect(result.advanced).toBe(1)
      expect(result.failed).toBe(2)
      expect(result.results[0]).toEqual({ partId: 'part_00001', success: true, newStatus: 'in_progress' })
      expect(result.results[1]).toMatchObject({ partId: 'part_00002', success: false })
      expect(result.results[1].error).toBeDefined()
      expect(result.results[2]).toMatchObject({ partId: 'part_00003', success: false })
      expect(result.results[2].error).toBeDefined()
    })

    it('throws ValidationError for empty array', () => {
      expect(() => service.batchAdvanceParts([], 'user_1')).toThrow(ValidationError)
    })

    it('throws ValidationError for more than 100 parts', () => {
      const ids = Array.from({ length: 101 }, (_, i) => `part_${String(i).padStart(5, '0')}`)
      expect(() => service.batchAdvanceParts(ids, 'user_1')).toThrow(ValidationError)
    })

    it('results length always equals input length', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_0' }))
      // part_00002 does not exist

      const ids = ['part_00001', 'part_00002']
      const result = service.batchAdvanceParts(ids, 'user_1')

      expect(result.results).toHaveLength(ids.length)
    })

    it('advanced + failed equals total input length', () => {
      partRepo.create(makePart({ id: 'part_00001', currentStepId: 'step_0' }))
      partRepo.create(makePart({ id: 'part_00002', currentStepId: null, status: 'completed' }))

      const ids = ['part_00001', 'part_00002']
      const result = service.batchAdvanceParts(ids, 'user_1')

      expect(result.advanced + result.failed).toBe(ids.length)
    })
  })

  describe('deletePart', () => {
    let userRepo: UserRepository
    let partStepStatusRepo: PartStepStatusRepository
    let partStepOverrideRepo: PartStepOverrideRepository
    let db: ReturnType<typeof createMockDb>
    let adminService: ReturnType<typeof createPartService>

    beforeEach(() => {
      userRepo = createMockUserRepo([makeAdminUser({ id: 'admin_1' })])
      partStepStatusRepo = createMockPartStepStatusRepo()
      partStepOverrideRepo = createMockPartStepOverrideRepo()
      db = createMockDb()
      adminService = createPartService(
        {
          parts: partRepo,
          paths: pathRepo,
          certs: certRepo,
          users: userRepo,
          partStepStatuses: partStepStatusRepo,
          partStepOverrides: partStepOverrideRepo,
          db,
        },
        auditService,
        partIdGenerator,
      )
    })

    it('deletes the part and cascades dependent rows inside a transaction', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const txSpy = vi.spyOn(db, 'transaction')

      const result = adminService.deletePart('part_00001', 'admin_1')

      expect(result).toEqual({ deletedPartId: 'part_00001' })
      expect(txSpy).toHaveBeenCalledTimes(1)
      expect(certRepo.deleteAttachmentsByPartIds).toHaveBeenCalledWith(['part_00001'])
      expect(partStepOverrideRepo.deleteByPartIds).toHaveBeenCalledWith(['part_00001'])
      expect(partStepStatusRepo.deleteByPartIds).toHaveBeenCalledWith(['part_00001'])
      expect(partRepo.delete).toHaveBeenCalledWith('part_00001')
      expect(partRepo.getById('part_00001')).toBeNull()
    })

    it('records an audit entry with job, path, and part metadata', () => {
      partRepo.create(makePart({
        id: 'part_00001',
        jobId: 'job_1',
        pathId: 'path_1',
        currentStepId: 'step_0',
        status: 'in_progress',
      }))

      adminService.deletePart('part_00001', 'admin_1')

      expect(auditService.recordPartDeletion).toHaveBeenCalledWith({
        userId: 'admin_1',
        partId: 'part_00001',
        jobId: 'job_1',
        pathId: 'path_1',
        metadata: {
          status: 'in_progress',
          currentStepId: 'step_0',
        },
      })
    })

    it('throws NotFoundError when the part does not exist', () => {
      expect(() => adminService.deletePart('nonexistent', 'admin_1')).toThrow(NotFoundError)
      expect(partRepo.delete).not.toHaveBeenCalled()
      expect(auditService.recordPartDeletion).not.toHaveBeenCalled()
    })

    it('throws ForbiddenError when the user is not an admin', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const nonAdminRepo = createMockUserRepo([
        makeAdminUser({ id: 'user_1', isAdmin: false }),
      ])
      const nonAdminService = createPartService(
        {
          parts: partRepo,
          paths: pathRepo,
          certs: certRepo,
          users: nonAdminRepo,
          partStepStatuses: partStepStatusRepo,
          partStepOverrides: partStepOverrideRepo,
          db,
        },
        auditService,
        partIdGenerator,
      )

      expect(() => nonAdminService.deletePart('part_00001', 'user_1')).toThrow(ForbiddenError)
      expect(partRepo.delete).not.toHaveBeenCalled()
    })

    it('throws ValidationError when userId is missing', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      expect(() => adminService.deletePart('part_00001', '')).toThrow(ValidationError)
      expect(partRepo.delete).not.toHaveBeenCalled()
    })

    it('throws ValidationError when the user does not exist', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      expect(() => adminService.deletePart('part_00001', 'ghost')).toThrow(ValidationError)
      expect(partRepo.delete).not.toHaveBeenCalled()
    })

    it('throws ValidationError when user repository is not wired', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const bareService = createPartService(
        { parts: partRepo, paths: pathRepo, certs: certRepo },
        auditService,
        partIdGenerator,
      )
      expect(() => bareService.deletePart('part_00001', 'admin_1')).toThrow(ValidationError)
    })

    it('throws ValidationError when cascade repositories are not wired', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const noCascadeService = createPartService(
        {
          parts: partRepo,
          paths: pathRepo,
          certs: certRepo,
          users: userRepo,
        },
        auditService,
        partIdGenerator,
      )
      expect(() => noCascadeService.deletePart('part_00001', 'admin_1')).toThrow(ValidationError)
      expect(partRepo.delete).not.toHaveBeenCalled()
    })

    it('cascades in FK-safe order: cert_attachments → overrides → statuses → part', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const callOrder: string[] = []
      ;(certRepo.deleteAttachmentsByPartIds as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('certs')
      })
      ;(partStepOverrideRepo.deleteByPartIds as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('overrides')
      })
      ;(partStepStatusRepo.deleteByPartIds as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('statuses')
      })
      ;(partRepo.delete as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('part')
      })

      adminService.deletePart('part_00001', 'admin_1')

      expect(callOrder).toEqual(['certs', 'overrides', 'statuses', 'part'])
    })

    it('deletes a completed part', () => {
      partRepo.create(makePart({ id: 'part_00001', status: 'completed', currentStepId: null }))

      const result = adminService.deletePart('part_00001', 'admin_1')

      expect(result).toEqual({ deletedPartId: 'part_00001' })
      expect(auditService.recordPartDeletion).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { status: 'completed', currentStepId: null } }),
      )
    })

    it('deletes a scrapped part', () => {
      partRepo.create(makePart({ id: 'part_00001', status: 'scrapped', currentStepId: 'step_1' }))

      const result = adminService.deletePart('part_00001', 'admin_1')

      expect(result).toEqual({ deletedPartId: 'part_00001' })
      expect(auditService.recordPartDeletion).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { status: 'scrapped', currentStepId: 'step_1' } }),
      )
    })

    it('does not record audit when transaction throws', () => {
      partRepo.create(makePart({ id: 'part_00001' }))
      const failDb = {
        transaction: () => () => { throw new Error('disk full') },
      }
      const failService = createPartService(
        {
          parts: partRepo,
          paths: pathRepo,
          certs: certRepo,
          users: userRepo,
          partStepStatuses: partStepStatusRepo,
          partStepOverrides: partStepOverrideRepo,
          db: failDb,
        },
        auditService,
        partIdGenerator,
      )

      expect(() => failService.deletePart('part_00001', 'admin_1')).toThrow('disk full')
      expect(auditService.recordPartDeletion).not.toHaveBeenCalled()
    })
  })
})
