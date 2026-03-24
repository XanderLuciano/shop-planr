import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createJobService } from '../../../server/services/jobService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { JobRepository } from '../../../server/repositories/interfaces/jobRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { SerialRepository } from '../../../server/repositories/interfaces/serialRepository'
import type { Job, SerialNumber } from '../../../server/types/domain'

function createMockJobRepo(): JobRepository {
  const store = new Map<string, Job>()
  return {
    create: vi.fn((job: Job) => { store.set(job.id, job); return job }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()]),
    update: vi.fn((id: string, partial: Partial<Job>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id))
  }
}

function createMockPathRepo(): PathRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByJobId: vi.fn(() => []),
    update: vi.fn(),
    delete: vi.fn()
  } as unknown as PathRepository
}

function createMockSerialRepo(serials: SerialNumber[] = []): SerialRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(),
    listByJobId: vi.fn(() => serials),
    listByStepIndex: vi.fn(),
    update: vi.fn(),
    countByJobId: vi.fn((jobId: string) => serials.filter(s => s.jobId === jobId).length),
    countCompletedByJobId: vi.fn((jobId: string) => serials.filter(s => s.jobId === jobId && s.currentStepIndex === -1).length),
    countScrappedByJobId: vi.fn((jobId: string) => serials.filter(s => s.jobId === jobId && s.status === 'scrapped').length),
    listAll: vi.fn(() => serials),
  }
}

describe('JobService', () => {
  let jobRepo: JobRepository
  let pathRepo: PathRepository
  let serialRepo: SerialRepository
  let service: ReturnType<typeof createJobService>

  beforeEach(() => {
    jobRepo = createMockJobRepo()
    pathRepo = createMockPathRepo()
    serialRepo = createMockSerialRepo()
    service = createJobService({ jobs: jobRepo, paths: pathRepo, serials: serialRepo })
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
        jiraTicketSummary: 'Some ticket'
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
    it('computes progress for a job with no serials', () => {
      const job = service.createJob({ name: 'Empty Job', goalQuantity: 10 })
      const progress = service.computeJobProgress(job.id)
      expect(progress.jobId).toBe(job.id)
      expect(progress.jobName).toBe('Empty Job')
      expect(progress.goalQuantity).toBe(10)
      expect(progress.totalSerials).toBe(0)
      expect(progress.completedSerials).toBe(0)
      expect(progress.inProgressSerials).toBe(0)
      expect(progress.progressPercent).toBe(0)
    })

    it('computes progress with completed and in-progress serials', () => {
      const job = service.createJob({ name: 'Active Job', goalQuantity: 10 })

      // Rebuild service with serials that reference this job
      const serials: SerialNumber[] = [
        { id: 'sn1', jobId: job.id, pathId: 'p1', currentStepIndex: 0, status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn2', jobId: job.id, pathId: 'p1', currentStepIndex: 1, status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn3', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn4', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn5', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' }
      ]
      const serialRepoWithData = createMockSerialRepo(serials)
      const svc = createJobService({ jobs: jobRepo, paths: pathRepo, serials: serialRepoWithData })

      const progress = svc.computeJobProgress(job.id)
      expect(progress.totalSerials).toBe(5)
      expect(progress.completedSerials).toBe(3)
      expect(progress.inProgressSerials).toBe(2)
      expect(progress.progressPercent).toBe(30) // 3/10 * 100
    })

    it('allows progress to exceed 100%', () => {
      const job = service.createJob({ name: 'Over Job', goalQuantity: 2 })

      const serials: SerialNumber[] = [
        { id: 'sn1', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn2', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn3', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' }
      ]
      const serialRepoWithData = createMockSerialRepo(serials)
      const svc = createJobService({ jobs: jobRepo, paths: pathRepo, serials: serialRepoWithData })

      const progress = svc.computeJobProgress(job.id)
      expect(progress.progressPercent).toBe(150) // 3/2 * 100
    })

    it('throws NotFoundError for missing job', () => {
      expect(() => service.computeJobProgress('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('getJobPartCount', () => {
    it('returns 0 when no serials exist', () => {
      const job = service.createJob({ name: 'Empty', goalQuantity: 5 })
      expect(service.getJobPartCount(job.id)).toBe(0)
    })

    it('returns total serial count across all paths', () => {
      const job = service.createJob({ name: 'Parts Job', goalQuantity: 10 })

      const serials: SerialNumber[] = [
        { id: 'sn1', jobId: job.id, pathId: 'p1', currentStepIndex: 0, status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn2', jobId: job.id, pathId: 'p2', currentStepIndex: 1, status: 'in_progress', forceCompleted: false, createdAt: '', updatedAt: '' },
        { id: 'sn3', jobId: job.id, pathId: 'p1', currentStepIndex: -1, status: 'completed', forceCompleted: false, createdAt: '', updatedAt: '' }
      ]
      const serialRepoWithData = createMockSerialRepo(serials)
      const svc = createJobService({ jobs: jobRepo, paths: pathRepo, serials: serialRepoWithData })

      expect(svc.getJobPartCount(job.id)).toBe(3)
    })
  })
})
