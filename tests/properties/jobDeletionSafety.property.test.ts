/**
 * Job Deletion Safety — Property-Based Tests
 *
 * Five properties verifying that deleteJob and canDeleteJob enforce
 * safety invariants across all combinations of dependents (paths, parts, BOM refs).
 *
 * Uses mock repositories driven by fast-check arbitraries so each run
 * exercises a fresh combination of dependent counts.
 */
import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { createJobService } from '../../server/services/jobService'
import { NotFoundError, ValidationError } from '../../server/utils/errors'
import type { JobRepository } from '../../server/repositories/interfaces/jobRepository'
import type { PathRepository } from '../../server/repositories/interfaces/pathRepository'
import type { PartRepository } from '../../server/repositories/interfaces/partRepository'
import type { BomRepository } from '../../server/repositories/interfaces/bomRepository'
import type { Job } from '../../server/types/domain'

// ---------------------------------------------------------------------------
// Mock factories — configurable dependent counts
// ---------------------------------------------------------------------------

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
    delete: vi.fn((id: string) => store.delete(id)),
  }
}

function createMockPathRepo(pathCount: number): PathRepository {
  const fakePaths = Array.from({ length: pathCount }, (_, i) => ({ id: `path_${i}` }))
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByJobId: vi.fn(() => fakePaths as any[]),
    update: vi.fn(),
    delete: vi.fn(),
    getStepById: vi.fn(),
    updateStepAssignment: vi.fn(),
    updateStep: vi.fn(),
    hasStepDependents: vi.fn(),
  }
}

function createMockPartRepo(partCount: number): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(),
    listByJobId: vi.fn(),
    listByCurrentStepId: vi.fn(),
    update: vi.fn(),
    countByJobId: vi.fn(() => partCount),
    countCompletedByJobId: vi.fn(() => 0),
    countScrappedByJobId: vi.fn(() => 0),
    listAll: vi.fn(),
  }
}

function createMockBomRepo(bomRefCount: number): BomRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countContributingJobRefs: vi.fn(() => bomRefCount),
  }
}

/** Seed a job into the mock repo and return it */
function seedJob(jobRepo: JobRepository, id: string): Job {
  const job: Job = {
    id,
    name: `Job ${id}`,
    goalQuantity: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  jobRepo.create(job)
  return job
}

/** Build a service with the given dependent counts */
function buildService(opts: { pathCount: number, partCount: number, bomRefCount: number }) {
  const jobRepo = createMockJobRepo()
  const pathRepo = createMockPathRepo(opts.pathCount)
  const partRepo = createMockPartRepo(opts.partCount)
  const bomRepo = createMockBomRepo(opts.bomRefCount)
  const service = createJobService({ jobs: jobRepo, paths: pathRepo, parts: partRepo, bom: bomRepo })
  return { service, jobRepo, pathRepo, partRepo, bomRepo }
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('Property 1: Deletion Safety', () => {
  /**
   * For any job, if deleteJob succeeds then the job had 0 paths,
   * 0 parts, and 0 BOM refs at deletion time.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it('deleteJob succeeds only when all dependent counts are zero', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }), // pathCount
        fc.nat({ max: 10 }), // partCount
        fc.nat({ max: 5 }), // bomRefCount
        (pathCount, partCount, bomRefCount) => {
          const { service, jobRepo } = buildService({ pathCount, partCount, bomRefCount })
          const job = seedJob(jobRepo, `job_${pathCount}_${partCount}_${bomRefCount}`)

          const hasDependents = pathCount > 0 || partCount > 0 || bomRefCount > 0

          if (hasDependents) {
            // Should throw — we just confirm it doesn't succeed
            expect(() => service.deleteJob(job.id)).toThrow()
          } else {
            // Should succeed — confirming all counts were 0
            expect(() => service.deleteJob(job.id)).not.toThrow()
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 2: Deletion Rejection', () => {
  /**
   * For any job with at least one dependent (path, part, or BOM ref),
   * deleteJob throws ValidationError and the job remains in the database.
   *
   * **Validates: Requirements 2.2, 2.3, 2.4**
   */
  it('deleteJob throws ValidationError when dependents exist and job survives', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }), // pathCount
        fc.nat({ max: 10 }), // partCount
        fc.nat({ max: 5 }), // bomRefCount
        (pathCount, partCount, bomRefCount) => {
          // Pre-filter: at least one dependent must exist
          fc.pre(pathCount > 0 || partCount > 0 || bomRefCount > 0)

          const { service, jobRepo } = buildService({ pathCount, partCount, bomRefCount })
          const job = seedJob(jobRepo, `job_rej_${pathCount}_${partCount}_${bomRefCount}`)

          expect(() => service.deleteJob(job.id)).toThrow(ValidationError)

          // Job must still be retrievable
          expect(jobRepo.getById(job.id)).not.toBeNull()
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 3: Deletion Completeness', () => {
  /**
   * For any job with no dependents, after deleteJob succeeds,
   * getById returns null.
   *
   * **Validates: Requirements 2.1, 2.6**
   */
  it('after successful deleteJob, the job is no longer retrievable', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        (jobId) => {
          const { service, jobRepo } = buildService({ pathCount: 0, partCount: 0, bomRefCount: 0 })
          seedJob(jobRepo, jobId)

          // Precondition: job exists
          expect(jobRepo.getById(jobId)).not.toBeNull()

          service.deleteJob(jobId)

          // Postcondition: job is gone
          expect(jobRepo.getById(jobId)).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 4: Not Found Invariant', () => {
  /**
   * For any non-existent ID, both deleteJob and canDeleteJob
   * throw NotFoundError.
   *
   * **Validates: Requirements 2.5, 3.3**
   */
  it('deleteJob and canDeleteJob both throw NotFoundError for any missing ID', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (missingId) => {
          // Empty repos — no jobs exist at all
          const { service } = buildService({ pathCount: 0, partCount: 0, bomRefCount: 0 })

          expect(() => service.deleteJob(missingId)).toThrow(NotFoundError)
          expect(() => service.canDeleteJob(missingId)).toThrow(NotFoundError)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 5: canDeleteJob Consistency', () => {
  /**
   * canDeleteJob returning canDelete:true implies deleteJob succeeds,
   * and canDelete:false implies deleteJob throws ValidationError.
   *
   * **Validates: Requirements 2.1, 3.1, 3.2**
   */
  it('canDeleteJob result predicts deleteJob outcome for any dependent combination', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }), // pathCount
        fc.nat({ max: 10 }), // partCount
        fc.nat({ max: 5 }), // bomRefCount
        (pathCount, partCount, bomRefCount) => {
          const { service, jobRepo } = buildService({ pathCount, partCount, bomRefCount })
          const job = seedJob(jobRepo, `job_con_${pathCount}_${partCount}_${bomRefCount}`)

          const check = service.canDeleteJob(job.id)

          if (check.canDelete) {
            // canDelete:true → deleteJob must succeed
            expect(() => service.deleteJob(job.id)).not.toThrow()
          } else {
            // canDelete:false → deleteJob must throw ValidationError
            expect(() => service.deleteJob(job.id)).toThrow(ValidationError)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
