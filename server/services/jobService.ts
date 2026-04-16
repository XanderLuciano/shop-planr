import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { BomRepository } from '../repositories/interfaces/bomRepository'
import type { JobTagRepository } from '../repositories/interfaces/jobTagRepository'
import type { TagRepository } from '../repositories/interfaces/tagRepository'
import type { Job, Tag } from '../types/domain'
import type { CreateJobInput, UpdateJobInput, UpdatePrioritiesInput } from '../types/api'
import type { JobProgress } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertPositive, assertNonEmpty, assertDefined } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

function buildJobProgress(
  job: Job,
  counts: { total: number, completed: number, scrapped: number },
): JobProgress {
  const { total: totalParts, completed: completedParts, scrapped: scrappedParts } = counts
  const inProgressParts = totalParts - completedParts - scrappedParts

  const adjustedGoal = job.goalQuantity - scrappedParts
  const progressPercent = adjustedGoal > 0
    ? (completedParts / adjustedGoal) * 100
    : (completedParts > 0 ? 100 : 0)

  return {
    jobId: job.id,
    jobName: job.name,
    goalQuantity: job.goalQuantity,
    totalParts,
    completedParts,
    inProgressParts,
    scrappedParts,
    producedQuantity: totalParts,
    orderedQuantity: job.goalQuantity,
    progressPercent,
  }
}

export function createJobService(repos: {
  jobs: JobRepository
  paths: PathRepository
  parts: PartRepository
  bom?: BomRepository
  jobTags?: JobTagRepository
  tags?: TagRepository
}) {
  return {
    createJob(input: CreateJobInput): Job {
      assertNonEmpty(input.name, 'name')
      assertPositive(input.goalQuantity, 'goalQuantity')

      const now = new Date().toISOString()
      return repos.jobs.createWithAutoIncPriority({
        id: generateId('job'),
        name: input.name.trim(),
        goalQuantity: input.goalQuantity,
        jiraTicketKey: input.jiraTicketKey,
        jiraTicketSummary: input.jiraTicketSummary,
        jiraPartNumber: input.jiraPartNumber,
        jiraPriority: input.jiraPriority,
        jiraEpicLink: input.jiraEpicLink,
        jiraLabels: input.jiraLabels,
        createdAt: now,
        updatedAt: now,
      })
    },

    getJob(id: string): Job {
      const job = repos.jobs.getById(id)
      if (!job) {
        throw new NotFoundError('Job', id)
      }
      return job
    },

    listJobs(): Job[] {
      return repos.jobs.list()
    },

    updateJob(id: string, input: UpdateJobInput): Job {
      const existing = repos.jobs.getById(id)
      if (!existing) {
        throw new NotFoundError('Job', id)
      }

      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
      }
      if (input.goalQuantity !== undefined) {
        assertPositive(input.goalQuantity, 'goalQuantity')
      }

      const partial: Partial<Job> = { updatedAt: new Date().toISOString() }
      if (input.name !== undefined) partial.name = input.name.trim()
      if (input.goalQuantity !== undefined) partial.goalQuantity = input.goalQuantity

      return repos.jobs.update(id, partial)
    },

    computeJobProgress(jobId: string): JobProgress {
      const job = repos.jobs.getById(jobId)
      if (!job) {
        throw new NotFoundError('Job', jobId)
      }

      return buildJobProgress(job, {
        total: repos.parts.countByJobId(jobId),
        completed: repos.parts.countCompletedByJobId(jobId),
        scrapped: repos.parts.countScrappedByJobId(jobId),
      })
    },

    computeAllJobProgress(): JobProgress[] {
      const jobs = repos.jobs.list()
      const countsByJob = repos.parts.countsByJob()

      return jobs.map((job) => {
        const counts = countsByJob.get(job.id) ?? { total: 0, completed: 0, scrapped: 0 }
        return buildJobProgress(job, counts)
      })
    },

    getJobPartCount(jobId: string): number {
      return repos.parts.countByJobId(jobId)
    },

    deleteJob(id: string): void {
      const job = repos.jobs.getById(id)
      if (!job) {
        throw new NotFoundError('Job', id)
      }

      const paths = repos.paths.listByJobId(id)
      if (paths.length > 0) {
        throw new ValidationError(`Cannot delete job: it has ${paths.length} path(s). Remove all paths first.`)
      }

      const partCount = repos.parts.countByJobId(id)
      if (partCount > 0) {
        throw new ValidationError(`Cannot delete job: it has ${partCount} part(s). Remove all parts first.`)
      }

      const bomRefCount = repos.bom
        ? repos.bom.countContributingJobRefs(id)
        : 0
      if (bomRefCount > 0) {
        throw new ValidationError(`Cannot delete job: it is referenced by ${bomRefCount} BOM entry/entries. Remove BOM references first.`)
      }

      repos.jobs.delete(id)
    },

    updatePriorities(input: UpdatePrioritiesInput): Job[] {
      // 1. Validate array not empty
      if (!input.priorities || input.priorities.length === 0) {
        throw new ValidationError('Priorities list must not be empty')
      }

      // Determine which jobs are completed (completedParts >= goalQuantity)
      const allJobs = repos.jobs.list()
      const completedJobIds = new Set<string>()
      for (const job of allJobs) {
        if (job.goalQuantity > 0) {
          const completed = repos.parts.countCompletedByJobId(job.id)
          if (completed >= job.goalQuantity) {
            completedJobIds.add(job.id)
          }
        }
      }
      const activeJobs = allJobs.filter(j => !completedJobIds.has(j.id))

      // 2. Validate count matches active (non-completed) job count
      if (input.priorities.length !== activeJobs.length) {
        throw new ValidationError(
          `Priority list must include all ${activeJobs.length} active jobs, got ${input.priorities.length}`,
        )
      }

      // 3. Validate no duplicate job IDs
      const idSet = new Set(input.priorities.map(e => e.jobId))
      if (idSet.size !== input.priorities.length) {
        throw new ValidationError('Duplicate job IDs in priority list')
      }

      // 4. Validate all job IDs exist and are active
      const activeIds = new Set(activeJobs.map(j => j.id))
      for (const entry of input.priorities) {
        if (!activeIds.has(entry.jobId)) {
          const exists = allJobs.some(j => j.id === entry.jobId)
          if (!exists) {
            throw new NotFoundError('Job', entry.jobId)
          }
          throw new ValidationError(`Job ${entry.jobId} is completed and cannot be prioritized`)
        }
      }

      // 5. Validate no duplicate priority values
      const prioritySet = new Set(input.priorities.map(e => e.priority))
      if (prioritySet.size !== input.priorities.length) {
        throw new ValidationError('Duplicate priority values in priority list')
      }

      // 6. Validate priorities form contiguous sequence 1..N
      for (let i = 1; i <= input.priorities.length; i++) {
        if (!prioritySet.has(i)) {
          throw new ValidationError('Priorities must be sequential from 1 to N')
        }
      }

      // Build bulk update: active jobs get their new priority, completed jobs get 0
      const entries = input.priorities.map(e => ({ id: e.jobId, priority: e.priority }))
      for (const job of allJobs) {
        if (completedJobIds.has(job.id) && job.priority !== 0) {
          entries.push({ id: job.id, priority: 0 })
        }
      }

      repos.jobs.bulkUpdatePriority(entries)

      // Return updated list sorted by priority
      return repos.jobs.list()
    },

    canDeleteJob(id: string): { canDelete: boolean, reasons: string[] } {
      const job = repos.jobs.getById(id)
      if (!job) {
        throw new NotFoundError('Job', id)
      }

      const reasons: string[] = []

      const paths = repos.paths.listByJobId(id)
      if (paths.length > 0) {
        reasons.push(`Job has ${paths.length} path(s)`)
      }

      const partCount = repos.parts.countByJobId(id)
      if (partCount > 0) {
        reasons.push(`Job has ${partCount} part(s)`)
      }

      const bomRefCount = repos.bom
        ? repos.bom.countContributingJobRefs(id)
        : 0
      if (bomRefCount > 0) {
        reasons.push(`Job is referenced by ${bomRefCount} BOM entry/entries`)
      }

      return { canDelete: reasons.length === 0, reasons }
    },

    setJobTags(_userId: string, jobId: string, tagIds: string[]): Tag[] {
      assertDefined(repos.jobTags, 'jobTags repository')
      assertDefined(repos.tags, 'tags repository')

      const job = repos.jobs.getById(jobId)
      if (!job) {
        throw new NotFoundError('Job', jobId)
      }

      const uniqueIds = [...new Set(tagIds)]

      if (uniqueIds.length > 0) {
        const foundTags = repos.tags.getByIds(uniqueIds)
        if (foundTags.length !== uniqueIds.length) {
          const foundIds = new Set(foundTags.map(t => t.id))
          const missingId = uniqueIds.find(id => !foundIds.has(id))!
          throw new NotFoundError('Tag', missingId)
        }
      }

      repos.jobTags.replaceJobTags(jobId, uniqueIds)
      return repos.jobTags.getTagsByJobId(jobId)
    },

    /**
     * Returns every job enriched with its tag list in a single pass, using a
     * bulk JOIN under the hood so we never N+1. Tag repos must be wired —
     * callers that don't wire them should use `repos.jobs.list()` directly.
     */
    listJobsWithTags(): (Job & { tags: Tag[] })[] {
      assertDefined(repos.jobTags, 'jobTags repository')

      const jobs = repos.jobs.list()
      const jobIds = jobs.map(j => j.id)
      const tagMap = repos.jobTags.getTagsForJobs(jobIds)

      return jobs.map(job => ({ ...job, tags: tagMap.get(job.id) ?? [] }))
    },
  }
}

export type JobService = ReturnType<typeof createJobService>
