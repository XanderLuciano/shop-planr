import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createJobService } from '../../../server/services/jobService'
import type { JobRepository } from '../../../server/repositories/interfaces/jobRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { Job, Part } from '../../../server/types/domain'

function makePart(overrides: Partial<Part> & { id: string, jobId: string }): Part {
  return {
    pathId: 'path_1',
    currentStepId: 'step_0',
    status: 'in_progress',
    forceCompleted: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function createMockJobRepo(jobs: Job[] = []): JobRepository {
  const store = new Map<string, Job>(jobs.map(j => [j.id, j]))
  return {
    create: vi.fn((job: Job) => {
      store.set(job.id, job)
      return job
    }),
    createWithAutoIncPriority: vi.fn((job: Omit<Job, 'priority'>) => {
      const full = { ...job, priority: store.size + 1 } as Job
      store.set(full.id, full)
      return full
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()]),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdatePriority: vi.fn(),
  }
}

function createMockPartRepo(parts: Part[] = []): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(),
    listByJobId: vi.fn(),
    listByCurrentStepId: vi.fn(),
    update: vi.fn(),
    countByJobId: vi.fn((jobId: string) => parts.filter(p => p.jobId === jobId).length),
    countCompletedByJobId: vi.fn((jobId: string) =>
      parts.filter(p => p.jobId === jobId && p.currentStepId === null && p.status === 'completed').length,
    ),
    countScrappedByJobId: vi.fn((jobId: string) =>
      parts.filter(p => p.jobId === jobId && p.status === 'scrapped').length,
    ),
    countsByJob: vi.fn(() => {
      const map = new Map<string, { total: number, completed: number, scrapped: number }>()
      for (const p of parts) {
        const entry = map.get(p.jobId) ?? { total: 0, completed: 0, scrapped: 0 }
        entry.total++
        if (p.currentStepId === null && p.status === 'completed') entry.completed++
        if (p.status === 'scrapped') entry.scrapped++
        map.set(p.jobId, entry)
      }
      return map
    }),
    listAll: vi.fn(() => parts),
    listAllEnriched: vi.fn(() => []),
    deleteByPathId: vi.fn(() => 0),
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

describe('computeAllJobProgress', () => {
  let jobRepo: JobRepository
  let pathRepo: PathRepository

  beforeEach(() => {
    pathRepo = createMockPathRepo()
  })

  it('returns empty array when no jobs exist', () => {
    jobRepo = createMockJobRepo([])
    const partRepo = createMockPartRepo([])
    const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo })
    expect(svc.computeAllJobProgress()).toEqual([])
  })

  it('returns progress for a single job with no parts', () => {
    const job: Job = {
      id: 'job_1', name: 'Empty Job', goalQuantity: 10, priority: 1,
      createdAt: '', updatedAt: '',
    }
    jobRepo = createMockJobRepo([job])
    const partRepo = createMockPartRepo([])
    const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo })

    const result = svc.computeAllJobProgress()
    expect(result).toHaveLength(1)
    expect(result[0].jobId).toBe('job_1')
    expect(result[0].totalParts).toBe(0)
    expect(result[0].progressPercent).toBe(0)
  })

  it('returns progress for multiple jobs with mixed part states', () => {
    const jobA: Job = {
      id: 'job_a', name: 'Job A', goalQuantity: 10, priority: 1,
      createdAt: '', updatedAt: '',
    }
    const jobB: Job = {
      id: 'job_b', name: 'Job B', goalQuantity: 4, priority: 2,
      createdAt: '', updatedAt: '',
    }
    jobRepo = createMockJobRepo([jobA, jobB])

    const parts: Part[] = [
      makePart({ id: 'p1', jobId: 'job_a', currentStepId: 'step_0' }),
      makePart({ id: 'p2', jobId: 'job_a', currentStepId: null, status: 'completed' }),
      makePart({ id: 'p3', jobId: 'job_a', status: 'scrapped', currentStepId: 'step_0' }),
      makePart({ id: 'p4', jobId: 'job_b', currentStepId: null, status: 'completed' }),
      makePart({ id: 'p5', jobId: 'job_b', currentStepId: null, status: 'completed' }),
    ]
    const partRepo = createMockPartRepo(parts)
    const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo })

    const result = svc.computeAllJobProgress()
    expect(result).toHaveLength(2)

    const progressA = result.find(p => p.jobId === 'job_a')!
    expect(progressA.totalParts).toBe(3)
    expect(progressA.completedParts).toBe(1)
    expect(progressA.scrappedParts).toBe(1)
    expect(progressA.inProgressParts).toBe(1)
    // adjustedGoal = 10 - 1 = 9, percent = 1/9 * 100
    expect(progressA.progressPercent).toBeCloseTo(11.11, 1)

    const progressB = result.find(p => p.jobId === 'job_b')!
    expect(progressB.totalParts).toBe(2)
    expect(progressB.completedParts).toBe(2)
    expect(progressB.progressPercent).toBe(50) // 2/4 * 100
  })

  it('matches computeJobProgress output for each job', () => {
    const job: Job = {
      id: 'job_x', name: 'Consistency Check', goalQuantity: 5, priority: 1,
      createdAt: '', updatedAt: '',
    }
    jobRepo = createMockJobRepo([job])

    const parts: Part[] = [
      makePart({ id: 'p1', jobId: 'job_x', currentStepId: null, status: 'completed' }),
      makePart({ id: 'p2', jobId: 'job_x', currentStepId: 'step_1' }),
    ]
    const partRepo = createMockPartRepo(parts)
    const svc = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo })

    const bulk = svc.computeAllJobProgress()
    const single = svc.computeJobProgress('job_x')

    expect(bulk).toHaveLength(1)
    expect(bulk[0]).toEqual(single)
  })
})
