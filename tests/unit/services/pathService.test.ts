import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPathService } from '../../../server/services/pathService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { Path, Part } from '../../../server/types/domain'

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

function createMockPartRepo(parts: Part[] = []): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn((pathId: string) => parts.filter(s => s.pathId === pathId)),
    listByJobId: vi.fn(),
    listByStepIndex: vi.fn((pathId: string, stepIndex: number) =>
      parts.filter(s => s.pathId === pathId && s.currentStepIndex === stepIndex)
    ),
    update: vi.fn(),
    countByJobId: vi.fn(),
    countCompletedByJobId: vi.fn(),
    countScrappedByJobId: vi.fn(() => 0),
    listAll: vi.fn(() => [])
  }
}

describe('PathService', () => {
  let pathRepo: PathRepository
  let partRepo: PartRepository
  let service: ReturnType<typeof createPathService>

  beforeEach(() => {
    pathRepo = createMockPathRepo()
    partRepo = createMockPartRepo()
    service = createPathService({ paths: pathRepo, parts: partRepo })
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
    it('returns distribution with part counts per step', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'Machining' }, { name: 'Inspection' }, { name: 'Coating' }]
      })

      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' },
        { id: 'p4', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      const dist = svc.getStepDistribution(path.id)
      expect(dist).toHaveLength(3)
      expect(dist[0].stepName).toBe('Machining')
      expect(dist[0].partCount).toBe(2)
      expect(dist[0].isBottleneck).toBe(true)
      expect(dist[1].stepName).toBe('Inspection')
      expect(dist[1].partCount).toBe(1)
      expect(dist[1].isBottleneck).toBe(false)
      expect(dist[2].stepName).toBe('Coating')
      expect(dist[2].partCount).toBe(0)
      expect(dist[2].isBottleneck).toBe(false)
      // completedCount = parts past this step (currentStepIndex > order OR === -1)
      // Step 0: p3 (at 1 > 0) + p4 (at -1) = 2
      expect(dist[0].completedCount).toBe(2)
      // Step 1: p4 (at -1) = 1
      expect(dist[1].completedCount).toBe(1)
      // Step 2: p4 (at -1) = 1
      expect(dist[2].completedCount).toBe(1)
    })

    it('returns no bottleneck when all steps have zero parts', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })
      const dist = service.getStepDistribution(path.id)
      expect(dist.every(d => !d.isBottleneck)).toBe(true)
      expect(dist.every(d => d.partCount === 0)).toBe(true)
      expect(dist.every(d => d.completedCount === 0)).toBe(true)
    })

    it('counts completed parts in completedCount for each step', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }, { name: 'S3' }]
      })

      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' },
        { id: 'p4', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      const dist = svc.getStepDistribution(path.id)
      // 3 completed parts (stepIndex === -1) count as done for every step
      expect(dist[0].completedCount).toBe(3)
      expect(dist[1].completedCount).toBe(3)
      expect(dist[2].completedCount).toBe(3)
    })

    it('throws NotFoundError for missing path', () => {
      expect(() => service.getStepDistribution('nonexistent')).toThrow(NotFoundError)
    })

    it('marks multiple steps as bottleneck when tied', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })

      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      const dist = svc.getStepDistribution(path.id)
      expect(dist[0].isBottleneck).toBe(true)
      expect(dist[1].isBottleneck).toBe(true)
      // Step 0: p2 (at 1 > 0) = 1 done
      expect(dist[0].completedCount).toBe(1)
      // Step 1: no parts past step 1 or completed = 0 done
      expect(dist[1].completedCount).toBe(0)
    })

    it('parts at various stages produce correct per-step done counts with monotonicity', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'Cutting' }, { name: 'Welding' }, { name: 'Painting' }]
      })

      // 2 parts at step 0, 1 part at step 1, 1 part at step 2, 3 completed
      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' },
        { id: 'p4', jobId: 'job_1', pathId: path.id, currentStepIndex: 2, createdAt: '', updatedAt: '' },
        { id: 'p5', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' },
        { id: 'p6', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' },
        { id: 'p7', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      const dist = svc.getStepDistribution(path.id)

      // Step 0 (Cutting): past = p3(1>0) + p4(2>0) + p5(-1) + p6(-1) + p7(-1) = 5
      expect(dist[0].completedCount).toBe(5)
      // Step 1 (Welding): past = p4(2>1) + p5(-1) + p6(-1) + p7(-1) = 4
      expect(dist[1].completedCount).toBe(4)
      // Step 2 (Painting): past = p5(-1) + p6(-1) + p7(-1) = 3
      expect(dist[2].completedCount).toBe(3)

      // Monotonicity: done counts are non-increasing from first to last step
      for (let i = 0; i < dist.length - 1; i++) {
        expect(dist[i].completedCount).toBeGreaterThanOrEqual(dist[i + 1].completedCount)
      }

      // partCount correctness
      expect(dist[0].partCount).toBe(2)
      expect(dist[1].partCount).toBe(1)
      expect(dist[2].partCount).toBe(1)
    })
  })

  describe('getPathCompletedCount', () => {
    it('returns correct count of parts with currentStepIndex === -1', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })

      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: 'job_1', pathId: path.id, currentStepIndex: -1, createdAt: '', updatedAt: '' },
        { id: 'p4', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      expect(svc.getPathCompletedCount(path.id)).toBe(2)
    })

    it('returns 0 when no parts are completed', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10,
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })

      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: 'job_1', pathId: path.id, currentStepIndex: 1, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      expect(svc.getPathCompletedCount(path.id)).toBe(0)
    })

    it('throws NotFoundError for missing path', () => {
      expect(() => service.getPathCompletedCount('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('deletePath', () => {
    it('deletes a path when no parts are attached', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })
      const result = service.deletePath(path.id)
      expect(result).toBe(true)
      expect(pathRepo.delete).toHaveBeenCalledWith(path.id)
    })

    it('throws ValidationError when parts are attached to the path', () => {
      const path = service.createPath({
        jobId: 'job_1', name: 'Route', goalQuantity: 10, steps: [{ name: 'S1' }]
      })

      const parts: Part[] = [
        { id: 'p1', jobId: 'job_1', pathId: path.id, currentStepIndex: 0, createdAt: '', updatedAt: '' }
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createPathService({ paths: pathRepo, parts: partRepoWithData })

      expect(() => svc.deletePath(path.id)).toThrow(ValidationError)
      expect(() => svc.deletePath(path.id)).toThrow('Cannot delete path with parts attached')
    })

    it('throws NotFoundError for non-existent path ID', () => {
      expect(() => service.deletePath('nonexistent')).toThrow(NotFoundError)
    })
  })
})
