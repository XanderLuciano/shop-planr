import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBomService } from '../../../server/services/bomService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { BomRepository } from '../../../server/repositories/interfaces/bomRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { BOM } from '../../../server/types/domain'

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

describe('BomService', () => {
  let bomRepo: BomRepository
  let partRepo: PartRepository
  let service: ReturnType<typeof createBomService>

  beforeEach(() => {
    bomRepo = createMockBomRepo()
    partRepo = createMockPartRepo()
    service = createBomService({ bom: bomRepo, parts: partRepo })
  })

  describe('createBom', () => {
    it('creates a BOM with generated ID and timestamps', () => {
      const bom = service.createBom({
        name: 'Assembly A',
        entries: [{ partType: 'Bracket', requiredQuantityPerBuild: 4, contributingJobIds: [] }],
      })
      expect(bom.id).toMatch(/^bom_/)
      expect(bom.name).toBe('Assembly A')
      expect(bom.entries).toHaveLength(1)
      expect(bom.entries[0].partType).toBe('Bracket')
      expect(bom.createdAt).toBeTruthy()
      expect(bom.updatedAt).toBeTruthy()
    })

    it('trims whitespace from name', () => {
      const bom = service.createBom({
        name: '  Trimmed BOM  ',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      expect(bom.name).toBe('Trimmed BOM')
    })

    it('throws ValidationError for empty name', () => {
      expect(() => service.createBom({
        name: '',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createBom({
        name: '   ',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
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
        entries: [{ partType: 'Widget', requiredQuantityPerBuild: 2, contributingJobIds: [] }],
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
      service.createBom({ name: 'BOM A', entries: [{ partType: 'A', requiredQuantityPerBuild: 1, contributingJobIds: [] }] })
      service.createBom({ name: 'BOM B', entries: [{ partType: 'B', requiredQuantityPerBuild: 2, contributingJobIds: [] }] })
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
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      const updated = service.updateBom(bom.id, { name: 'New Name' })
      expect(updated.name).toBe('New Name')
    })

    it('updates entries', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ partType: 'Old Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      const updated = service.updateBom(bom.id, {
        entries: [
          { partType: 'New Part', requiredQuantityPerBuild: 5, contributingJobIds: ['job_1'] },
        ],
      })
      expect(updated.entries).toHaveLength(1)
      expect(updated.entries[0].partType).toBe('New Part')
      expect(updated.entries[0].requiredQuantityPerBuild).toBe(5)
    })

    it('sets updatedAt on update', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      const updated = service.updateBom(bom.id, { name: 'Changed' })
      expect(updated.updatedAt).toBeTruthy()
    })

    it('throws NotFoundError for missing BOM', () => {
      expect(() => service.updateBom('nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('throws ValidationError for empty name update', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      expect(() => service.updateBom(bom.id, { name: '' })).toThrow(ValidationError)
    })
  })

  describe('getBomSummary', () => {
    it('returns zero counts for entries with no contributing jobs', () => {
      const bom = service.createBom({
        name: 'Empty BOM',
        entries: [{ partType: 'Bracket', requiredQuantityPerBuild: 10, contributingJobIds: [] }],
      })
      const summary = service.getBomSummary(bom.id)
      expect(summary.bomId).toBe(bom.id)
      expect(summary.bomName).toBe('Empty BOM')
      expect(summary.entries).toHaveLength(1)
      expect(summary.entries[0].totalCompleted).toBe(0)
      expect(summary.entries[0].totalInProgress).toBe(0)
      expect(summary.entries[0].totalOutstanding).toBe(0)
    })

    it('aggregates counts from contributing jobs', () => {
      const counts: Record<string, { total: number, completed: number }> = {
        job_a: { total: 10, completed: 6 },
        job_b: { total: 8, completed: 3 },
      }
      partRepo = createMockPartRepo(counts)
      service = createBomService({ bom: bomRepo, parts: partRepo })

      const bom = service.createBom({
        name: 'Assembly',
        entries: [{
          partType: 'Bracket',
          requiredQuantityPerBuild: 20,
          contributingJobIds: ['job_a', 'job_b'],
        }],
      })

      const summary = service.getBomSummary(bom.id)
      const entry = summary.entries[0]
      // totalCompleted = 6 + 3 = 9
      expect(entry.totalCompleted).toBe(9)
      // totalInProgress = (10-6) + (8-3) = 4 + 5 = 9
      expect(entry.totalInProgress).toBe(9)
      // totalOutstanding = max(0, 20 - 9) = 11
      expect(entry.totalOutstanding).toBe(11)
    })

    it('sets outstanding to zero when completed exceeds required', () => {
      const counts: Record<string, { total: number, completed: number }> = {
        job_a: { total: 15, completed: 15 },
      }
      partRepo = createMockPartRepo(counts)
      service = createBomService({ bom: bomRepo, parts: partRepo })

      const bom = service.createBom({
        name: 'Over-produced',
        entries: [{
          partType: 'Widget',
          requiredQuantityPerBuild: 10,
          contributingJobIds: ['job_a'],
        }],
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
      service = createBomService({ bom: bomRepo, parts: partRepo })

      const bom = service.createBom({
        name: 'Multi-entry',
        entries: [
          { partType: 'Bracket', requiredQuantityPerBuild: 10, contributingJobIds: ['job_a'] },
          { partType: 'Bolt', requiredQuantityPerBuild: 5, contributingJobIds: ['job_b'] },
        ],
      })

      const summary = service.getBomSummary(bom.id)
      expect(summary.entries).toHaveLength(2)

      const bracket = summary.entries[0]
      expect(bracket.partType).toBe('Bracket')
      expect(bracket.totalCompleted).toBe(3)
      expect(bracket.totalInProgress).toBe(2)
      expect(bracket.totalOutstanding).toBe(7)

      const bolt = summary.entries[1]
      expect(bolt.partType).toBe('Bolt')
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
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      const updated = service.editBom(bom.id, {
        name: 'Renamed BOM',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
        changeDescription: 'Renamed',
        userId: 'user_1',
      })
      expect(updated.name).toBe('Renamed BOM')
    })

    it('trims whitespace from name', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      const updated = service.editBom(bom.id, {
        name: '  Padded Name  ',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
        changeDescription: 'Trimmed',
        userId: 'user_1',
      })
      expect(updated.name).toBe('Padded Name')
    })

    it('keeps existing name when name is not provided', () => {
      const bom = service.createBom({
        name: 'Keep This',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      const updated = service.editBom(bom.id, {
        entries: [{ partType: 'New Part', requiredQuantityPerBuild: 2, contributingJobIds: [] }],
        changeDescription: 'Entries only',
        userId: 'user_1',
      })
      expect(updated.name).toBe('Keep This')
    })

    it('throws ValidationError for empty name', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      expect(() => service.editBom(bom.id, {
        name: '',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
        changeDescription: 'Bad name',
        userId: 'user_1',
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      const bom = service.createBom({
        name: 'Test',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
      })
      expect(() => service.editBom(bom.id, {
        name: '   ',
        entries: [{ partType: 'Part', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
        changeDescription: 'Whitespace name',
        userId: 'user_1',
      })).toThrow(ValidationError)
    })
  })
})
