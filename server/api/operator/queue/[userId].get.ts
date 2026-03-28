import type { WorkQueueJob, WorkQueueResponse } from '../../../types/computed'

export default defineEventHandler(async (event) => {
  try {
    const userId = getRouterParam(event, 'userId')
    if (!userId) {
      throw new ValidationError('userId is required')
    }

    const { jobService, pathService, partService } = getServices()
    const jobs = jobService.listJobs()

    // Map keyed by "jobId|pathId|stepOrder" → WorkQueueJob (in-progress build)
    const groupMap = new Map<string, WorkQueueJob>()

    for (const job of jobs) {
      const paths = pathService.listPathsByJob(job.id)

      for (const path of paths) {
        const totalSteps = path.steps.length

        for (const step of path.steps) {
          const parts = partService.listPartsByStepIndex(path.id, step.order)
          if (parts.length === 0) continue

          const key = `${job.id}|${path.id}|${step.order}`
          const isFinalStep = step.order === totalSteps - 1
          const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

          groupMap.set(key, {
            jobId: job.id,
            jobName: job.name,
            pathId: path.id,
            pathName: path.name,
            stepId: step.id,
            stepName: step.name,
            stepOrder: step.order,
            stepLocation: step.location,
            totalSteps,
            partIds: parts.map(s => s.id),
            partCount: parts.length,
            nextStepName: nextStep?.name,
            nextStepLocation: nextStep?.location,
            isFinalStep,
          })
        }
      }
    }

    const queueJobs = Array.from(groupMap.values())
    const totalParts = queueJobs.reduce((sum, j) => sum + j.partCount, 0)

    const response: WorkQueueResponse = {
      operatorId: userId,
      jobs: queueJobs,
      totalParts,
    }

    return response
  } catch (error) {
    if (error instanceof ValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
