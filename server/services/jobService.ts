import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { SerialRepository } from '../repositories/interfaces/serialRepository'
import type { Job } from '../types/domain'
import type { CreateJobInput, UpdateJobInput } from '../types/api'
import type { JobProgress } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertPositive, assertNonEmpty } from '../utils/validation'
import { NotFoundError } from '../utils/errors'

export function createJobService(repos: {
  jobs: JobRepository
  paths: PathRepository
  serials: SerialRepository
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

      const totalSerials = repos.serials.countByJobId(jobId)
      const completedSerials = repos.serials.countCompletedByJobId(jobId)
      const scrappedSerials = repos.serials.countScrappedByJobId(jobId)
      const inProgressSerials = totalSerials - completedSerials - scrappedSerials

      // progressPercent = completedCount / (goalQuantity - scrappedCount) * 100
      const adjustedGoal = job.goalQuantity - scrappedSerials
      const progressPercent = adjustedGoal > 0
        ? (completedSerials / adjustedGoal) * 100
        : (completedSerials > 0 ? 100 : 0)

      return {
        jobId: job.id,
        jobName: job.name,
        goalQuantity: job.goalQuantity,
        totalSerials,
        completedSerials,
        inProgressSerials,
        scrappedSerials,
        producedQuantity: totalSerials,
        orderedQuantity: job.goalQuantity,
        progressPercent,
      }
    },

    getJobPartCount(jobId: string): number {
      return repos.serials.countByJobId(jobId)
    }
  }
}

export type JobService = ReturnType<typeof createJobService>
