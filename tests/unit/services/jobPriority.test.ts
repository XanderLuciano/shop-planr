import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createJobService } from '../../../server/services/jobService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { JobRepository } from '../../../server/repositories/interfaces/jobRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { BomRepository } from '../../../server/repositories/interfaces/bomRepository'
import type { Job } from '../../../server/types/domain'

function createMockJobRepo(): JobRepository {
  const store = new Map<string, Job>()
  return {
    create: vi.fn((job: Job) => { store.set(job.id, job); return job }),
    createWithAutoIncPriority: vi.fn((job: Omit<Job, 'priority'>) => {
      let max = 0
      for (const j of store.values()) { if (j.priority > max) max = j.priority }
      const fullJob = { ...job, priority: max + 1 } as Job
      store.set(fullJob.id, fullJob)
      return fullJob
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()].sort((a, b) => a.priority - b.priority)),
    update: vi.fn((id: string, partial: Partial<Job>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id)),
    bulkUpdatePriority: vi.fn((entries: { id: string; priority: number }[]) => {
      for (const entry of entries) {
        const job = store.get(entry.id)
        if (job) {
          store.set(entry.id, { ...job, priority: entry.priority, updatedAt: new Date().toISOString() })
        }
      }
    }),
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

function createMockPartRepo(): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(),
    listByJobId: vi.fn(() => []),
    listByCurrentStepId: vi.fn(),
    update: vi.fn(),
    countByJobId: vi.fn(() => 0),
    countCompletedByJobId: vi.fn(() => 0),
    countScrappedByJobId: vi.fn(() => 0),
    listAll: vi.fn(() => []),
  } as unknown as PartRepository
}

function createMockBomRepo(): BomRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countContributingJobRefs: vi.fn(() => 0),
  } as unknown as BomRepository
}

/** Helper: create N jobs via the service and return them */
function seedJobs(service: ReturnType<typeof createJobService>, count: number): Job[] {
  const jobs: Job[] = []
  for (let i = 1; i <= count; i++) {
    jobs.push(service.createJob({ name: `Job ${i}`, goalQuantity: 10 }))
  }
  return jobs
}

describe('jobService.updatePriorities', () => {
  let jobRepo: JobRepository
  let service: ReturnType<typeof createJobService>

  beforeEach(() => {
    jobRepo = createMockJobRepo()
    service = createJobService({
      jobs: jobRepo,
      paths: createMockPathRepo(),
      parts: createMockPartRepo(),
      bom: createMockBomRepo()
    })
  })

  // Requirement 3.1, 3.2: valid reorder persists correctly
  it('reorders 3 jobs and returns updated list sorted by priority', () => {
    const [a, b, c] = seedJobs(service, 3)

    // Reverse the order: c=1, b=2, a=3
    const result = service.updatePriorities({
      priorities: [
        { jobId: c.id, priority: 1 },
        { jobId: b.id, priority: 2 },
        { jobId: a.id, priority: 3 }
      ]
    })

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe(c.id)
    expect(result[0].priority).toBe(1)
    expect(result[1].id).toBe(b.id)
    expect(result[1].priority).toBe(2)
    expect(result[2].id).toBe(a.id)
    expect(result[2].priority).toBe(3)
  })

  // Requirement 3.1: empty priorities array
  it('throws ValidationError for empty priorities array', () => {
    seedJobs(service, 2)
    expect(() => service.updatePriorities({ priorities: [] }))
      .toThrow(ValidationError)
  })

  // Requirement 3.3: duplicate job IDs
  it('throws ValidationError for duplicate job IDs', () => {
    const [a, b] = seedJobs(service, 2)
    expect(() => service.updatePriorities({
      priorities: [
        { jobId: a.id, priority: 1 },
        { jobId: a.id, priority: 2 }
      ]
    })).toThrow(ValidationError)
  })

  // Requirement 3.4: duplicate priority values
  it('throws ValidationError for duplicate priority values', () => {
    const [a, b] = seedJobs(service, 2)
    expect(() => service.updatePriorities({
      priorities: [
        { jobId: a.id, priority: 1 },
        { jobId: b.id, priority: 1 }
      ]
    })).toThrow(ValidationError)
  })

  // Requirement 3.5: non-sequential priorities (gap)
  it('throws ValidationError for non-sequential priorities', () => {
    const [a, b] = seedJobs(service, 2)
    expect(() => service.updatePriorities({
      priorities: [
        { jobId: a.id, priority: 1 },
        { jobId: b.id, priority: 3 }
      ]
    })).toThrow(ValidationError)
  })

  // Requirement 3.6: non-existent job ID
  it('throws NotFoundError for non-existent job ID', () => {
    const [a] = seedJobs(service, 1)
    expect(() => service.updatePriorities({
      priorities: [
        { jobId: 'job_nonexistent', priority: 1 }
      ]
    })).toThrow(NotFoundError)
  })

  // Requirement 3.7: count mismatch — fewer than total jobs
  it('throws ValidationError when fewer jobs than total are provided', () => {
    const [a, b, c] = seedJobs(service, 3)
    expect(() => service.updatePriorities({
      priorities: [
        { jobId: a.id, priority: 1 },
        { jobId: b.id, priority: 2 }
      ]
    })).toThrow(ValidationError)
  })

  // Requirement 3.7: count mismatch — more than total jobs
  it('throws ValidationError when more jobs than total are provided', () => {
    const [a] = seedJobs(service, 1)
    expect(() => service.updatePriorities({
      priorities: [
        { jobId: a.id, priority: 1 },
        { jobId: 'job_extra', priority: 2 }
      ]
    })).toThrow(ValidationError)
  })
})
