import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { BomRepository } from '../repositories/interfaces/bomRepository'
import type { Job } from '../types/domain'
import type { CreateJobInput, UpdateJobInput, UpdatePrioritiesInput } from '../types/api'
import type { JobProgress } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertPositive, assertNonEmpty } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

export function createJobService(repos: {
  jobs: JobRepository
  paths: PathRepository
  parts: PartRepository
  bom?: BomRepository
}) {
  return {
    createJob(input: CreateJobInput): Job {
      assertNonEmpty(input.name, 'name')
      assertPositive(input.goalQuantity, 'goalQuantity')

      const now = new Date().toISOString()
      const priority = repos.jobs.getMaxPriority() + 1
      return repos.jobs.create({
        id: generateId('job'),
        name: input.name.trim(),
        goalQuantity: input.goalQuantity,
        priority,
        jiraTicketKey: input.jiraTicketKey,
        jiraTicketSummary: input.jiraTicketSummary,
        jiraPartNumber: input.jiraPartNumber,
        jiraPriority: input.jiraPriority,
        jiraEpicLink: input.jiraEpicLink,
        jiraLabels: input.jiraLabels,
        createdAt: now,
        updatedAt: now
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

      const totalParts = repos.parts.countByJobId(jobId)
      const completedParts = repos.parts.countCompletedByJobId(jobId)
      const scrappedParts = repos.parts.countScrappedByJobId(jobId)
      const inProgressParts = totalParts - completedParts - scrappedParts

      // progressPercent = completedCount / (goalQuantity - scrappedCount) * 100
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

      // 2. Validate count matches total job count
      const allJobs = repos.jobs.list()
      if (input.priorities.length !== allJobs.length) {
        throw new ValidationError(
          `Priority list must include all ${allJobs.length} jobs, got ${input.priorities.length}`
        )
      }

      // 3. Validate no duplicate job IDs
      const idSet = new Set(input.priorities.map(e => e.jobId))
      if (idSet.size !== input.priorities.length) {
        throw new ValidationError('Duplicate job IDs in priority list')
      }

      // 4. Validate all job IDs exist
      const existingIds = new Set(allJobs.map(j => j.id))
      for (const entry of input.priorities) {
        if (!existingIds.has(entry.jobId)) {
          throw new NotFoundError('Job', entry.jobId)
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

      // Execute bulk update
      repos.jobs.bulkUpdatePriority(
        input.priorities.map(e => ({ id: e.jobId, priority: e.priority }))
      )

      // Return updated list sorted by priority
      return repos.jobs.list()
    },

    canDeleteJob(id: string): { canDelete: boolean; reasons: string[] } {
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
    }
  }
}

export type JobService = ReturnType<typeof createJobService>
