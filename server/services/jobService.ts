import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { Job } from '../types/domain'
import type { CreateJobInput, UpdateJobInput } from '../types/api'
import type { JobProgress } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertPositive, assertNonEmpty } from '../utils/validation'
import { NotFoundError } from '../utils/errors'

export function createJobService(repos: {
  jobs: JobRepository
  paths: PathRepository
  parts: PartRepository
}) {
  return {
    createJob(input: CreateJobInput): Job {
      assertNonEmpty(input.name, 'name')
      assertPositive(input.goalQuantity, 'goalQuantity')

      const now = new Date().toISOString()
      return repos.jobs.create({
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

      const totalParts = repos.parts.countByJobId(jobId)
      const completedParts = repos.parts.countCompletedByJobId(jobId)
      const scrappedParts = repos.parts.countScrappedByJobId(jobId)
      const inProgressParts = totalParts - completedParts - scrappedParts

      // progressPercent = completedCount / (goalQuantity - scrappedCount) * 100
      const adjustedGoal = job.goalQuantity - scrappedParts
      const progressPercent =
        adjustedGoal > 0 ? (completedParts / adjustedGoal) * 100 : completedParts > 0 ? 100 : 0

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
  }
}

export type JobService = ReturnType<typeof createJobService>
