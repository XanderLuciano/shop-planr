import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createJobService } from '../../../server/services/jobService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { JobRepository } from '../../../server/repositories/interfaces/jobRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { BomRepository } from '../../../server/repositories/interfaces/bomRepository'
import type { Job, Part } from '../../../server/types/domain'

function createMockJobRepo(): JobRepository {
  const store = new Map<string, Job>()
  return {
    create: vi.fn((job: Job) => {
      store.set(job.id, job)
      return job
    }),
    createWithAutoIncPriority: vi.fn((job: Omit<Job, 'priority'>) => {
      let max = 0
      for (const j of store.values()) {
        if (j.priority > max) max = j.priority
      }
      const fullJob = { ...job, priority: max + 1 } as Job
      store.set(fullJob.id, fullJob)
      return fullJob
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()]),
    update: vi.fn((id: string, partial: Partial<Job>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id)),
    bulkUpdatePriority: vi.fn(),
  }
}

function createMockPathRepo(): PathRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByJobId: vi.fn(() => []),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as PathRepository
}

function createMockPartRepo(parts: Part[] = []): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(),
    listByJobId: vi.fn(() => parts),
    listByCurrentStepId: vi.fn(),
    update: vi.fn(),
    countByJobId: vi.fn((jobId: string) => parts.filter(s => s.jobId === jobId).length),
    countCompletedByJobId: vi.fn((jobId: string) => parts.filter(s => s.jobId === jobId && s.currentStepId === null && s.status === 'completed').length),
    countScrappedByJobId: vi.fn((jobId: string) => parts.filter(s => s.jobId === jobId && s.status === 'scrapped').length),
    listAll: vi.fn(() => parts),
    listAllEnriched: vi.fn(() => []),
  }
}

function createMockBomRepo(bomRefCount: number = 0): BomRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countContributingJobRefs: vi.fn(() => bomRefCount),
  }
}

describe('JobService', () => {
  let jobRepo: JobRepository
  let pathRepo: PathRepository
  let partRepo: PartRepository
  let bomRepo: BomRepository
  let service: ReturnType<typeof createJobService>

  beforeEach(() => {
    jobRepo = createMockJobRepo()
    pathRepo = createMockPathRepo()
    partRepo = createMockPartRepo()
    bomRepo = createMockBomRepo()
    service = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo, bom: bomRepo })
  })

  describe('createJob', () => {
    it('creates a job with generated ID and timestamps', () => {
      const job = service.createJob({ name: 'Widget Batch', goalQuantity: 50 })
      expect(job.id).toMatch(/^job_/)
      expect(job.name).toBe('Widget Batch')
      expect(job.goalQuantity).toBe(50)
      expect(job.createdAt).toBeTruthy()
      expect(job.updatedAt).toBeTruthy()
    })

    it('trims whitespace from name', () => {
      const job = service.createJob({ name: '  Trimmed  ', goalQuantity: 10 })
      expect(job.name).toBe('Trimmed')
    })

    it('passes optional Jira fields through', () => {
      const job = service.createJob({
        name: 'Jira Job',
        goalQuantity: 5,
        jiraTicketKey: 'PI-123',
        jiraTicketSummary: 'Some ticket',
      })
      expect(job.jiraTicketKey).toBe('PI-123')
      expect(job.jiraTicketSummary).toBe('Some ticket')
    })

    it('throws ValidationError for empty name', () => {
      expect(() => service.createJob({ name: '', goalQuantity: 10 })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createJob({ name: '   ', goalQuantity: 10 })).toThrow(ValidationError)
    })

    it('throws ValidationError for goalQuantity of zero', () => {
      expect(() => service.createJob({ name: 'Test', goalQuantity: 0 })).toThrow(ValidationError)
    })

    it('throws ValidationError for negative goalQuantity', () => {
      expect(() => service.createJob({ name: 'Test', goalQuantity: -5 })).toThrow(ValidationError)
    })
  })

  describe('getJob', () => {
    it('returns existing job', () => {
      const created = service.createJob({ name: 'Test', goalQuantity: 10 })
      const found = service.getJob(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundError for missing job', () => {
      expect(() => service.getJob('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listJobs', () => {
    it('returns all jobs', () => {
      service.createJob({ name: 'Job A', goalQuantity: 10 })
      service.createJob({ name: 'Job B', goalQuantity: 20 })
      expect(service.listJobs()).toHaveLength(2)
    })

    it('returns empty array when no jobs exist', () => {
      expect(service.listJobs()).toHaveLength(0)
    })
  })

  describe('updateJob', () => {
    it('updates name', () => {
      const job = service.createJob({ name: 'Old Name', goalQuantity: 10 })
      const updated = service.updateJob(job.id, { name: 'New Name' })
      expect(updated.name).toBe('New Name')
    })

    it('updates goalQuantity', () => {
      const job = service.createJob({ name: 'Test', goalQuantity: 10 })
      const updated = service.updateJob(job.id, { goalQuantity: 25 })
      expect(updated.goalQuantity).toBe(25)
    })

    it('sets updatedAt on update', () => {
      const job = service.createJob({ name: 'Test', goalQuantity: 10 })
      const updated = service.updateJob(job.id, { name: 'Changed' })
      expect(updated.updatedAt).toBeTruthy()
    })

    it('throws NotFoundError for missing job', () => {
      expect(() => service.updateJob('nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('throws ValidationError for empty name update', () => {
      const job = service.createJob({ name: 'Test', goalQuantity: 10 })
      expect(() => service.updateJob(job.id, { name: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for zero goalQuantity update', () => {
      const job = service.createJob({ name: 'Test', goalQuantity: 10 })
      expect(() => service.updateJob(job.id, { goalQuantity: 0 })).toThrow(ValidationError)
    })

    it('throws ValidationError for negative goalQuantity update', () => {
      const job = service.createJob({ name: 'Test', goalQuantity: 10 })
      expect(() => service.updateJob(job.id, { goalQuantity: -1 })).toThrow(ValidationError)
    })
  })

  describe('computeJobProgress', () => {
    it('computes progress for a job with no parts', () => {
      const job = service.createJob({ name: 'Empty Job', goalQuantity: 10 })
      const progress = service.computeJobProgress(job.id)
      expect(progress.jobId).toBe(job.id)
      expect(progress.jobName).toBe('Empty Job')
      expect(progress.goalQuantity).toBe(10)
      expect(progress.totalParts).toBe(0)
      expect(progress.completedParts).toBe(0)
      expect(progress.inProgressParts).toBe(0)
      expect(progress.progressPercent).toBe(0)
    })

    it('computes progress with completed and in-progress parts', () => {
      const job = service.createJob({ name: 'Active Job', goalQuantity: 10 })

      // Rebuild service with parts that reference this job
      const parts: Part[] = [
        { id: 'p1', jobId: job.id, pathId: 'p1', currentStepId: 'step_0', status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: job.id, pathId: 'p1', currentStepId: 'step_1', status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p4', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p5', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepoWithData, bom: bomRepo })

      const progress = svc.computeJobProgress(job.id)
      expect(progress.totalParts).toBe(5)
      expect(progress.completedParts).toBe(3)
      expect(progress.inProgressParts).toBe(2)
      expect(progress.progressPercent).toBe(30) // 3/10 * 100
    })

    it('allows progress to exceed 100%', () => {
      const job = service.createJob({ name: 'Over Job', goalQuantity: 2 })

      const parts: Part[] = [
        { id: 'p1', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepoWithData, bom: bomRepo })

      const progress = svc.computeJobProgress(job.id)
      expect(progress.progressPercent).toBe(150) // 3/2 * 100
    })

    it('throws NotFoundError for missing job', () => {
      expect(() => service.computeJobProgress('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('getJobPartCount', () => {
    it('returns 0 when no parts exist', () => {
      const job = service.createJob({ name: 'Empty', goalQuantity: 5 })
      expect(service.getJobPartCount(job.id)).toBe(0)
    })

    it('returns total part count across all paths', () => {
      const job = service.createJob({ name: 'Parts Job', goalQuantity: 10 })

      const parts: Part[] = [
        { id: 'p1', jobId: job.id, pathId: 'p1', currentStepId: 'step_0', status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p2', jobId: job.id, pathId: 'p2', currentStepId: 'step_1', status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'p3', jobId: job.id, pathId: 'p1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
      ]
      const partRepoWithData = createMockPartRepo(parts)
      const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepoWithData, bom: bomRepo })

      expect(svc.getJobPartCount(job.id)).toBe(3)
    })
  })

  describe('deleteJob', () => {
    it('deletes a job with no dependents', () => {
      const job = service.createJob({ name: 'Deletable', goalQuantity: 5 })
      service.deleteJob(job.id)
      expect(() => service.getJob(job.id)).toThrow(NotFoundError)
      expect(jobRepo.delete).toHaveBeenCalledWith(job.id)
    })

    it('throws NotFoundError for non-existent ID', () => {
      expect(() => service.deleteJob('nonexistent')).toThrow(NotFoundError)
    })

    it('throws ValidationError when job has paths', () => {
      const job = service.createJob({ name: 'Has Paths', goalQuantity: 5 })
      vi.mocked(pathRepo.listByJobId).mockReturnValue([{ id: 'path1' } as any])
      expect(() => service.deleteJob(job.id)).toThrow(ValidationError)
      expect(() => service.deleteJob(job.id)).toThrow(/1 path\(s\)/)
      // Job should still exist
      expect(service.getJob(job.id).id).toBe(job.id)
    })

    it('throws ValidationError when job has parts', () => {
      const job = service.createJob({ name: 'Has Parts', goalQuantity: 5 })
      vi.mocked(partRepo.countByJobId).mockReturnValue(3)
      expect(() => service.deleteJob(job.id)).toThrow(ValidationError)
      expect(() => service.deleteJob(job.id)).toThrow(/3 part\(s\)/)
    })

    it('throws ValidationError when job has BOM references', () => {
      const job = service.createJob({ name: 'Has BOM', goalQuantity: 5 })
      vi.mocked(bomRepo.countContributingJobRefs).mockReturnValue(2)
      expect(() => service.deleteJob(job.id)).toThrow(ValidationError)
      expect(() => service.deleteJob(job.id)).toThrow(/2 BOM entry\/entries/)
    })
  })

  describe('canDeleteJob', () => {
    it('returns canDelete true when no dependents', () => {
      const job = service.createJob({ name: 'Clean', goalQuantity: 5 })
      const result = service.canDeleteJob(job.id)
      expect(result.canDelete).toBe(true)
      expect(result.reasons).toEqual([])
    })

    it('throws NotFoundError for non-existent ID', () => {
      expect(() => service.canDeleteJob('nonexistent')).toThrow(NotFoundError)
    })

    it('returns reasons for paths', () => {
      const job = service.createJob({ name: 'Has Paths', goalQuantity: 5 })
      vi.mocked(pathRepo.listByJobId).mockReturnValue([{ id: 'p1' } as any, { id: 'p2' } as any])
      const result = service.canDeleteJob(job.id)
      expect(result.canDelete).toBe(false)
      expect(result.reasons).toContainEqual(expect.stringContaining('2 path(s)'))
    })

    it('returns reasons for parts', () => {
      const job = service.createJob({ name: 'Has Parts', goalQuantity: 5 })
      vi.mocked(partRepo.countByJobId).mockReturnValue(4)
      const result = service.canDeleteJob(job.id)
      expect(result.canDelete).toBe(false)
      expect(result.reasons).toContainEqual(expect.stringContaining('4 part(s)'))
    })

    it('returns reasons for BOM references', () => {
      const job = service.createJob({ name: 'Has BOM', goalQuantity: 5 })
      vi.mocked(bomRepo.countContributingJobRefs).mockReturnValue(1)
      const result = service.canDeleteJob(job.id)
      expect(result.canDelete).toBe(false)
      expect(result.reasons).toContainEqual(expect.stringContaining('1 BOM entry/entries'))
    })

    it('returns all reasons when multiple dependents exist', () => {
      const job = service.createJob({ name: 'Blocked', goalQuantity: 5 })
      vi.mocked(pathRepo.listByJobId).mockReturnValue([{ id: 'p1' } as any])
      vi.mocked(partRepo.countByJobId).mockReturnValue(2)
      vi.mocked(bomRepo.countContributingJobRefs).mockReturnValue(3)
      const result = service.canDeleteJob(job.id)
      expect(result.canDelete).toBe(false)
      expect(result.reasons).toHaveLength(3)
    })
  })
})
