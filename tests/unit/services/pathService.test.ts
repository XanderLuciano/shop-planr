import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPathService } from '../../../server/services/pathService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { SerialRepository } from '../../../server/repositories/interfaces/serialRepository'
import type { Path, SerialNumber } from '../../../server/types/domain'

function createMockPathRepo(): PathRepository {
  const store = new Map<string, Path>()
  return {
    create: vi.fn((path: Path) => { store.set(path.id, path); return path }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    listByJobId: vi.fn((jobId: string) => [...store.values()].filter(p => p.jobId === jobId)),
    update: vi.fn((id: string, partial: Partial<Path>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id))
  }
}

function createMockSerialRepo(serials: SerialNumber[] = []): SerialRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn((pathId: string) => serials.filter(s => s.pathId === pathId)),
    listByJobId: vi.fn(),
    listByStepIndex: vi.fn((pathId: string, stepIndex: number) =>
      serials.filter(s => s.pathId === pathId && s.currentStepIndex === stepIndex)
    ),
    update: vi.fn(),
    countByJobId: vi.fn(),
    countCompletedByJobId: vi.fn()
  }
}

describe('PathService', () => {
  let pathRepo: PathRepository
  let serialRepo: SerialRepository
  let service: ReturnType<typeof createPathService>

  beforeEach(() => {
    pathRepo = createMockPathRepo()
    serialRepo = createMockSerialRepo()
    service = createPathService({ paths: pathRepo, serials: serialRepo })
  })

  describe('createPath', () => {
    it('creates a path with generated ID, steps, and timestamps', () => {
      const path = service.createPath({
        jobId: 'job_1',
        name: 'Main Route',
        goalQuantity: 50,
        steps: [{ name: 'Machining' }, { name: 'Inspection' }]
      })
      expect(path.id).toMatch(/^path_/)
      expect(path.jobId).toBe('job_1')
      expect(path.name).toBe('Main Route')
      expect(path.goalQuantity).toBe(50)
      expect(path.steps).toHaveLength(2)
      expect(path.steps[0].id).toMatch(/^step_/)
      expect(path.steps[0].name).toBe('Machining')
      expect(path.steps[0].order).toBe(0)
      expect(path.steps[1].order).toBe(1)
      expect(path.createdAt).toBeTruthy()
      expect(path.updatedAt).toBeTruthy()
    })

    it('trims whitespace from name', () => {
      const path = service.createPath({
        jobId: 'job_1',
        name: '  Trimmed  ',
        goalQuantity: 10,
        steps: [{ name: 'Step 1' }]
      })
      expect(path.name).toBe('Trimmed')
    })

    it('assigns optional location to steps', () => {
      const path = service.createPath({
        jobId: 'job_1',
        name: 'Route',
        goalQuantity: 10,
        steps: [{ name: 'Coating', location: 'Vendor - Anodize Co.' }]
      })
      expect(path.steps[0].location).toBe('Vendor - Anodize Co.')
    })

    it('throws ValidationError for empty name', () => {
      expect(() => service.createPath({
        jobId: 'job_1', name: '', goalQuantity: 10, steps: [{ name: 'S1' }]
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for zero goalQuantity', () => {
      expect(() => service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 0, steps: [{ name: 'S1' }]
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty steps array', () => {
      expect(() => service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: []
      })).toThrow(ValidationError)
    })
  })

  describe('getPath', () => {
    it('returns existing path', () => {
      const created = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      const found = service.getPath(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundError for missing path', () => {
      expect(() => service.getPath('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listPathsByJob', () => {
    it('returns paths for a given job', () => {
      service.createPath({ jobId: 'job_1', name: 'A', goalQuantity: 5, steps: [{ name: 'S1' }] })
      service.createPath({ jobId: 'job_1', name: 'B', goalQuantity: 5, steps: [{ name: 'S1' }] })
      service.createPath({ jobId: 'job_2', name: 'C', goalQuantity: 5, steps: [{ name: 'S1' }] })
      expect(service.listPathsByJob('job_1')).toHaveLength(2)
    })

    it('returns empty array when no paths exist for job', () => {
      expect(service.listPathsByJob('job_none')).toHaveLength(0)
    })
  })

  describe('updatePath', () => {
    it('updates name', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Old', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      const updated = service.updatePath(path.id, { name: 'New' })
      expect(updated.name).toBe('New')
    })

    it('updates goalQuantity', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      const updated = service.updatePath(path.id, { goalQuantity: 25 })
      expect(updated.goalQuantity).toBe(25)
    })

    it('updates steps with new IDs and ordering', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })
      const updated = service.updatePath(path.id, {
        steps: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
      })
      expect(updated.steps).toHaveLength(3)
      expect(updated.steps[0].name).toBe('A')
      expect(updated.steps[0].order).toBe(0)
      expect(updated.steps[2].order).toBe(2)
      expect(updated.steps[0].id).toMatch(/^step_/)
    })

    it('sets updatedAt on update', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      const updated = service.updatePath(path.id, { name: 'Changed' })
      expect(updated.updatedAt).toBeTruthy()
    })

    it('throws NotFoundError for missing path', () => {
      expect(() => service.updatePath('nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('throws ValidationError for empty name update', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      expect(() => service.updatePath(path.id, { name: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty steps update', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      expect(() => service.updatePath(path.id, { steps: [] })).toThrow(ValidationError)
    })

    it('throws ValidationError for zero goalQuantity update', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      expect(() => service.updatePath(path.id, { goalQuantity: 0 })).toThrow(ValidationError)
    })
  })

  describe('getStepDistribution', () => {
    it('returns distribution with serial counts per step', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'Machining' }, { name: 'Inspection' }, { name: 'Coating' }]
      })

      const serials: SerialNumber[] = [
        { id: 'sn1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'sn2', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'sn3', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' },
        { id: 'sn4', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' }
      ]
      const serialRepoWithData = createMockSerialRepo(serials)
      const svc = createPathService({ paths: pathRepo, serials: serialRepoWithData })

      const dist = svc.getStepDistribution(path.id)
      expect(dist).toHaveLength(3)
      expect(dist[0].stepName).toBe('Machining')
      expect(dist[0].serialCount).toBe(2)
      expect(dist[0].isBottleneck).toBe(true)
      expect(dist[1].stepName).toBe('Inspection')
      expect(dist[1].serialCount).toBe(1)
      expect(dist[1].isBottleneck).toBe(false)
      expect(dist[2].stepName).toBe('Coating')
      expect(dist[2].serialCount).toBe(0)
      expect(dist[2].isBottleneck).toBe(false)
      // completedCount should be 1 for all steps
      expect(dist[0].completedCount).toBe(1)
      expect(dist[1].completedCount).toBe(1)
    })

    it('returns no bottleneck when all steps have zero serials', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })
      const dist = service.getStepDistribution(path.id)
      expect(dist.every(d => !d.isBottleneck)).toBe(true)
      expect(dist.every(d => d.serialCount === 0)).toBe(true)
    })

    it('throws NotFoundError for missing path', () => {
      expect(() => service.getStepDistribution('nonexistent')).toThrow(NotFoundError)
    })

    it('marks multiple steps as bottleneck when tied', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })

      const serials: SerialNumber[] = [
        { id: 'sn1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'sn2', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' }
      ]
      const serialRepoWithData = createMockSerialRepo(serials)
      const svc = createPathService({ paths: pathRepo, serials: serialRepoWithData })

      const dist = svc.getStepDistribution(path.id)
      expect(dist[0].isBottleneck).toBe(true)
      expect(dist[1].isBottleneck).toBe(true)
    })
  })

  describe('deletePath', () => {
    it('deletes a path when no serials are attached', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      const result = service.deletePath(path.id)
      expect(result).toBe(true)
      expect(pathRepo.delete).toHaveBeenCalledWith(path.id)
    })

    it('throws ValidationError when serials are attached to the path', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })

      const serials: SerialNumber[] = [
        { id: 'sn1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' }
      ]
      const serialRepoWithData = createMockSerialRepo(serials)
      const svc = createPathService({ paths: pathRepo, serials: serialRepoWithData })

      expect(() => svc.deletePath(path.id)).toThrow(ValidationError)
      expect(() => svc.deletePath(path.id)).toThrow('Cannot delete path with serial numbers attached')
    })

    it('throws NotFoundError for non-existent path ID', () => {
      expect(() => service.deletePath('nonexistent')).toThrow(NotFoundError)
    })
  })
})
