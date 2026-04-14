import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createJobService } from '../../../server/services/jobService'
import { NotFoundError } from '../../../server/utils/errors'
import type { JobRepository } from '../../../server/repositories/interfaces/jobRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { PartRepository } from '../../../server/repositories/interfaces/partRepository'
import type { JobTagRepository } from '../../../server/repositories/interfaces/jobTagRepository'
import type { TagRepository } from '../../../server/repositories/interfaces/tagRepository'
import type { Job, Tag } from '../../../server/types/domain'

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
    countsByJob: vi.fn(() => new Map()),
    listAll: vi.fn(() => []),
    listAllEnriched: vi.fn(() => []),
  }
}

function createMockTagRepo(tags: Tag[] = []): TagRepository {
  const store = new Map<string, Tag>(tags.map(t => [t.id, t]))
  return {
    list: vi.fn(() => [...store.values()]),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    getByIds: vi.fn((ids: string[]) => ids.map(id => store.get(id)).filter(Boolean) as Tag[]),
    create: vi.fn((tag: Tag) => {
      store.set(tag.id, tag)
      return tag
    }),
    update: vi.fn(),
    delete: vi.fn(),
    findByName: vi.fn(),
  }
}

function createMockJobTagRepo(): JobTagRepository {
  const jobTagMap = new Map<string, string[]>()
  const allTags = new Map<string, Tag>()

  return {
    getTagsByJobId: vi.fn((jobId: string) => {
      const ids = jobTagMap.get(jobId) ?? []
      return ids.map(id => allTags.get(id)).filter(Boolean) as Tag[]
    }),
    getTagsForJobs: vi.fn((jobIds: string[]) => {
      const result = new Map<string, Tag[]>()
      for (const jobId of jobIds) {
        const ids = jobTagMap.get(jobId) ?? []
        result.set(jobId, ids.map(id => allTags.get(id)).filter(Boolean) as Tag[])
      }
      return result
    }),
    replaceJobTags: vi.fn((jobId: string, tagIds: string[]) => {
      jobTagMap.set(jobId, [...tagIds])
    }),
    removeAllTagsForJob: vi.fn((jobId: string) => {
      jobTagMap.delete(jobId)
    }),
    countJobsByTagId: vi.fn(() => 0),
  }
}

function makeTag(id: string, name: string): Tag {
  return { id, name, color: '#8b5cf6', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
}

describe('JobService.setJobTags', () => {
  let jobRepo: JobRepository
  let pathRepo: PathRepository
  let partRepo: PartRepository
  let jobTagRepo: JobTagRepository
  let tagRepo: TagRepository
  let service: ReturnType<typeof createJobService>

  const tagA = makeTag('tag_a', 'Alpha')
  const tagB = makeTag('tag_b', 'Beta')
  const tagC = makeTag('tag_c', 'Gamma')

  beforeEach(() => {
    jobRepo = createMockJobRepo()
    pathRepo = createMockPathRepo()
    partRepo = createMockPartRepo()
    tagRepo = createMockTagRepo([tagA, tagB, tagC])
    jobTagRepo = createMockJobTagRepo()
    service = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo, jobTags: jobTagRepo, tags: tagRepo })
  })

  it('replaces tags for a job', () => {
    const job = service.createJob({ name: 'Job A', goalQuantity: 10 })
    service.setJobTags(job.id, ['tag_a', 'tag_b'])
    expect(jobTagRepo.replaceJobTags).toHaveBeenCalledWith(job.id, ['tag_a', 'tag_b'])
  })

  it('deduplicates tagIds before replacing', () => {
    const job = service.createJob({ name: 'Job B', goalQuantity: 5 })
    service.setJobTags(job.id, ['tag_a', 'tag_b', 'tag_a'])
    expect(jobTagRepo.replaceJobTags).toHaveBeenCalledWith(job.id, ['tag_a', 'tag_b'])
  })

  it('clears all tags when tagIds is empty', () => {
    const job = service.createJob({ name: 'Job C', goalQuantity: 5 })
    service.setJobTags(job.id, [])
    expect(jobTagRepo.replaceJobTags).toHaveBeenCalledWith(job.id, [])
  })

  it('throws NotFoundError when job does not exist', () => {
    expect(() => service.setJobTags('nonexistent_job', ['tag_a'])).toThrow(NotFoundError)
  })

  it('throws NotFoundError when a tag does not exist', () => {
    const job = service.createJob({ name: 'Job D', goalQuantity: 5 })
    expect(() => service.setJobTags(job.id, ['tag_a', 'tag_missing'])).toThrow(NotFoundError)
  })

  it('returns the resulting Tag[] after replacement', () => {
    const job = service.createJob({ name: 'Job E', goalQuantity: 5 })
    // jobTagRepo.getTagsByJobId is called after replaceJobTags; mock it to return the set tags
    vi.mocked(jobTagRepo.getTagsByJobId).mockReturnValue([tagA, tagB])
    const result = service.setJobTags(job.id, ['tag_a', 'tag_b'])
    expect(result).toEqual([tagA, tagB])
  })
})
