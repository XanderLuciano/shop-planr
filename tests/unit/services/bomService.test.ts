import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBomService } from '../../../server/services/bomService'
import { NotFoundError, ValidationError, ForbiddenError } from '../../../server/utils/errors'
import type { BomRepository } from '../../../server/repositories/interfaces/bomRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { JobRepository } from '../../../server/repositories/interfaces/jobRepository'
import type { UserRepository } from '../../../server/repositories/interfaces/userRepository'
import type { AuditService } from '../../../server/services/auditService'
import type { BOM, Job, ShopUser } from '../../../server/types/domain'

function createMockBomRepo(): BomRepository {
  const store = new Map<string, BOM>()
  return {
    create: vi.fn((bom: BOM) => {
      store.set(bom.id, bom)
      return bom
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()]),
    update: vi.fn((id: string, partial: Partial<BOM>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id)),
    countJobRefs: vi.fn(() => 0),
  }
}

function createMockPartRepo(counts: Record<string, { total: number, completed: number }> = {}): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(),
    listByJobId: vi.fn(() => []),
    listByCurrentStepId: vi.fn(),
    update: vi.fn(),
    countByJobId: vi.fn((jobId: string) => counts[jobId]?.total ?? 0),
    countCompletedByJobId: vi.fn((jobId: string) => counts[jobId]?.completed ?? 0),
    countScrappedByJobId: vi.fn(() => 0),
    countsByJob: vi.fn(() => new Map()),
    listAll: vi.fn(() => []),
    listAllEnriched: vi.fn(() => []),
  }
}

function createMockJobRepo(jobs: Record<string, string> = {}): JobRepository {
  return {
    create: vi.fn(),
    getById: vi.fn((id: string) => jobs[id] ? { id, name: jobs[id] } as Job : null),
    list: vi.fn(() => Object.entries(jobs).map(([id, name]) => ({ id, name }) as Job)),
    update: vi.fn(),
    delete: vi.fn(),
    listByIds: vi.fn(),
  }
}

const ADMIN_ID = 'user_admin'
const REGULAR_ID = 'user_regular'

function createMockUserRepo(): UserRepository {
  const now = '2024-01-01T00:00:00.000Z'
  const users = new Map<string, ShopUser>([
    [ADMIN_ID, { id: ADMIN_ID, username: 'admin', displayName: 'Admin', isAdmin: true, active: true, createdAt: now, pinHash: null }],
    [REGULAR_ID, { id: REGULAR_ID, username: 'reg', displayName: 'Regular', isAdmin: false, active: true, createdAt: now, pinHash: null }],
  ])
  return {
    getById: vi.fn((id: string) => users.get(id) ?? null),
    getByUsername: vi.fn(),
    list: vi.fn(() => [...users.values()]),
    listActive: vi.fn(() => [...users.values()].filter(u => u.active)),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as UserRepository
}

function createMockAuditService(): AuditService {
  return {
    recordBomEdited: vi.fn(() => ({ id: 'aud_1' })),
    recordBomArchived: vi.fn(() => ({ id: 'aud_2' })),
  } as unknown as AuditService
}

describe('BomService', () => {
  let bomRepo: BomRepository
  let partRepo: PartRepository
  let jobRepo: JobRepository
  let service: ReturnType<typeof createBomService>

  beforeEach(() => {
    bomRepo = createMockBomRepo()
    partRepo = createMockPartRepo()
    jobRepo = createMockJobRepo({ job_a: 'Bracket Job', job_b: 'Bolt Job' })
    service = createBomService({ bom: bomRepo, parts: partRepo, jobs: jobRepo })
  })

  describe('createBom', () => {
    it('creates a BOM with generated ID and timestamps', () => {
      const bom = service.createBom({
        name: 'Assembly A',
        entries: [{ jobId: 'job_a' }],
      })
      expect(bom.id).toMatch(/^bom_/)
      expect(bom.name).toBe('Assembly A')
      expect(bom.entries).toHaveLength(1)
      expect(bom.entries[0].jobId).toBe('job_a')
      expect(bom.entries[0].requiredQuantity).toBe(1)
      expect(bom.createdAt).toBeTruthy()
    })

    it('defaults requiredQuantity to 1', () => {
      const bom = service.createBom({
        name: 'Default Qty',
        entries: [{ jobId: 'job_a' }],
      })
      expect(bom.entries[0].requiredQuantity).toBe(1)
    })

    it('respects explicit requiredQuantity', () => {
      const bom = service.createBom({
        name: 'Custom Qty',
        entries: [{ jobId: 'job_a', requiredQuantity: 5 }],
      })
      expect(bom.entries[0].requiredQuantity).toBe(5)
    })

    it('trims whitespace from name', () => {
      const bom = service.createBom({
        name: '  Trimmed BOM  ',
        entries: [{ jobId: 'job_a' }],
      })
      expect(bom.name).toBe('Trimmed BOM')
    })

    it('throws ValidationError for empty name', () => {
      expect(() => service.createBom({
        name: '',
        entries: [{ jobId: 'job_a' }],
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createBom({
        name: '   ',
        entries: [{ jobId: 'job_a' }],
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty entries array', () => {
      expect(() => service.createBom({ name: 'No Entries', entries: [] })).toThrow(ValidationError)
    })
  })

  describe('getBom', () => {
    it('returns existing BOM', () => {
      const created = service.createBom({
        name: 'Test BOM',
        entries: [{ jobId: 'job_a', requiredQuantity: 2 }],
      })
      const found = service.getBom(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundError for missing BOM', () => {
      expect(() => service.getBom('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listBoms', () => {
    it('returns all BOMs', () => {
      service.createBom({ name: 'BOM A', entries: [{ jobId: 'job_a' }] })
      service.createBom({ name: 'BOM B', entries: [{ jobId: 'job_b' }] })
      expect(service.listBoms()).toHaveLength(2)
    })

    it('returns empty array when no BOMs exist', () => {
      expect(service.listBoms()).toHaveLength(0)
    })
  })

  describe('updateBom', () => {
    it('updates name', () => {
      const bom = service.createBom({
        name: 'Old Name',
        entries: [{ jobId: 'job_a' }],
      })
      const updated = service.updateBom(bom.id, { name: 'New Name' })
      expect(updated.name).toBe('New Name')
    })

    it('updates entries', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ jobId: 'job_a' }],
      })
      const updated = service.updateBom(bom.id, {
        entries: [{ jobId: 'job_b', requiredQuantity: 5 }],
      })
      expect(updated.entries).toHaveLength(1)
      expect(updated.entries[0].jobId).toBe('job_b')
      expect(updated.entries[0].requiredQuantity).toBe(5)
    })

    it('throws NotFoundError for missing BOM', () => {
      expect(() => service.updateBom('nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('throws ValidationError for empty name update', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ jobId: 'job_a' }],
      })
      expect(() => service.updateBom(bom.id, { name: '' })).toThrow(ValidationError)
    })
  })

  describe('getBomSummary', () => {
    it('returns summary with job names and part counts', () => {
      const counts: Record<string, { total: number, completed: number }> = {
        job_a: { total: 10, completed: 6 },
      }
      partRepo = createMockPartRepo(counts)
      service = createBomService({ bom: bomRepo, parts: partRepo, jobs: jobRepo })

      const bom = service.createBom({
        name: 'Assembly',
        entries: [{ jobId: 'job_a', requiredQuantity: 20 }],
      })

      const summary = service.getBomSummary(bom.id)
      const entry = summary.entries[0]
      expect(entry.jobId).toBe('job_a')
      expect(entry.jobName).toBe('Bracket Job')
      expect(entry.totalCompleted).toBe(6)
      expect(entry.totalInProgress).toBe(4)
      expect(entry.totalOutstanding).toBe(14)
    })

    it('sets outstanding to zero when completed exceeds required', () => {
      const counts: Record<string, { total: number, completed: number }> = {
        job_a: { total: 15, completed: 15 },
      }
      partRepo = createMockPartRepo(counts)
      service = createBomService({ bom: bomRepo, parts: partRepo, jobs: jobRepo })

      const bom = service.createBom({
        name: 'Over-produced',
        entries: [{ jobId: 'job_a', requiredQuantity: 10 }],
      })

      const summary = service.getBomSummary(bom.id)
      expect(summary.entries[0].totalCompleted).toBe(15)
      expect(summary.entries[0].totalOutstanding).toBe(0)
    })

    it('handles multiple entries independently', () => {
      const counts: Record<string, { total: number, completed: number }> = {
        job_a: { total: 5, completed: 3 },
        job_b: { total: 4, completed: 4 },
      }
      partRepo = createMockPartRepo(counts)
      service = createBomService({ bom: bomRepo, parts: partRepo, jobs: jobRepo })

      const bom = service.createBom({
        name: 'Multi-entry',
        entries: [
          { jobId: 'job_a', requiredQuantity: 10 },
          { jobId: 'job_b', requiredQuantity: 5 },
        ],
      })

      const summary = service.getBomSummary(bom.id)
      expect(summary.entries).toHaveLength(2)

      const bracket = summary.entries[0]
      expect(bracket.jobName).toBe('Bracket Job')
      expect(bracket.totalCompleted).toBe(3)
      expect(bracket.totalInProgress).toBe(2)
      expect(bracket.totalOutstanding).toBe(7)

      const bolt = summary.entries[1]
      expect(bolt.jobName).toBe('Bolt Job')
      expect(bolt.totalCompleted).toBe(4)
      expect(bolt.totalInProgress).toBe(0)
      expect(bolt.totalOutstanding).toBe(1)
    })

    it('throws NotFoundError for missing BOM', () => {
      expect(() => service.getBomSummary('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('editBom', () => {
    it('updates BOM name when provided', () => {
      const bom = service.createBom({
        name: 'Original Name',
        entries: [{ jobId: 'job_a' }],
      })
      const updated = service.editBom(bom.id, {
        name: 'Renamed BOM',
        entries: [{ jobId: 'job_a' }],
        changeDescription: 'Renamed',
        userId: 'user_1',
      })
      expect(updated.name).toBe('Renamed BOM')
    })

    it('trims whitespace from name', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ jobId: 'job_a' }],
      })
      const updated = service.editBom(bom.id, {
        name: '  Padded Name  ',
        entries: [{ jobId: 'job_a' }],
        changeDescription: 'Trimmed',
        userId: 'user_1',
      })
      expect(updated.name).toBe('Padded Name')
    })

    it('keeps existing name when name is not provided', () => {
      const bom = service.createBom({
        name: 'Keep This',
        entries: [{ jobId: 'job_a' }],
      })
      const updated = service.editBom(bom.id, {
        entries: [{ jobId: 'job_b', requiredQuantity: 2 }],
        changeDescription: 'Entries only',
        userId: 'user_1',
      })
      expect(updated.name).toBe('Keep This')
    })

    it('throws ValidationError for empty name', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ jobId: 'job_a' }],
      })
      expect(() => service.editBom(bom.id, {
        name: '',
        entries: [{ jobId: 'job_a' }],
        changeDescription: 'Bad name',
        userId: 'user_1',
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ jobId: 'job_a' }],
      })
      expect(() => service.editBom(bom.id, {
        name: '   ',
        entries: [{ jobId: 'job_a' }],
        changeDescription: 'Whitespace name',
        userId: 'user_1',
      })).toThrow(ValidationError)
    })
  })

  describe('archiveBom / unarchiveBom', () => {
    let adminService: ReturnType<typeof createBomService>
    let auditService: AuditService

    beforeEach(() => {
      bomRepo = createMockBomRepo()
      partRepo = createMockPartRepo()
      jobRepo = createMockJobRepo({ job_a: 'Bracket Job' })
      auditService = createMockAuditService()
      adminService = createBomService(
        { bom: bomRepo, parts: partRepo, jobs: jobRepo, users: createMockUserRepo() },
        auditService,
      )
    })

    it('admin can archive a BOM', () => {
      const bom = adminService.createBom({ name: 'Archive Me', entries: [{ jobId: 'job_a' }] })
      const archived = adminService.archiveBom(bom.id, ADMIN_ID)
      expect(archived.archivedAt).toBeTruthy()
    })

    it('admin can unarchive a BOM', () => {
      const bom = adminService.createBom({ name: 'Restore Me', entries: [{ jobId: 'job_a' }] })
      adminService.archiveBom(bom.id, ADMIN_ID)
      const restored = adminService.unarchiveBom(bom.id, ADMIN_ID)
      expect(restored.archivedAt).toBeNull()
    })

    it('rejects archive with ForbiddenError for non-admin', () => {
      const bom = adminService.createBom({ name: 'Guarded', entries: [{ jobId: 'job_a' }] })
      expect(() => adminService.archiveBom(bom.id, REGULAR_ID)).toThrow(ForbiddenError)
    })

    it('rejects unarchive with ForbiddenError for non-admin', () => {
      const bom = adminService.createBom({ name: 'Guarded', entries: [{ jobId: 'job_a' }] })
      adminService.archiveBom(bom.id, ADMIN_ID)
      expect(() => adminService.unarchiveBom(bom.id, REGULAR_ID)).toThrow(ForbiddenError)
    })

    it('throws ValidationError when archiving already-archived BOM', () => {
      const bom = adminService.createBom({ name: 'Double Archive', entries: [{ jobId: 'job_a' }] })
      adminService.archiveBom(bom.id, ADMIN_ID)
      expect(() => adminService.archiveBom(bom.id, ADMIN_ID)).toThrow(ValidationError)
    })

    it('throws ValidationError when unarchiving non-archived BOM', () => {
      const bom = adminService.createBom({ name: 'Not Archived', entries: [{ jobId: 'job_a' }] })
      expect(() => adminService.unarchiveBom(bom.id, ADMIN_ID)).toThrow(ValidationError)
    })

    it('throws NotFoundError for missing BOM on archive', () => {
      expect(() => adminService.archiveBom('nonexistent', ADMIN_ID)).toThrow(NotFoundError)
    })

    it('throws NotFoundError for missing BOM on unarchive', () => {
      expect(() => adminService.unarchiveBom('nonexistent', ADMIN_ID)).toThrow(NotFoundError)
    })

    it('records audit entry on archive', () => {
      const bom = adminService.createBom({ name: 'Audited', entries: [{ jobId: 'job_a' }] })
      adminService.archiveBom(bom.id, ADMIN_ID)
      expect(auditService.recordBomArchived).toHaveBeenCalledWith({
        userId: ADMIN_ID,
        metadata: { bomId: bom.id, bomName: 'Audited', archived: true },
      })
    })

    it('records audit entry on unarchive', () => {
      const bom = adminService.createBom({ name: 'Audited', entries: [{ jobId: 'job_a' }] })
      adminService.archiveBom(bom.id, ADMIN_ID)
      adminService.unarchiveBom(bom.id, ADMIN_ID)
      expect(auditService.recordBomArchived).toHaveBeenCalledWith({
        userId: ADMIN_ID,
        metadata: { bomId: bom.id, bomName: 'Audited', archived: false },
      })
    })
  })
})
