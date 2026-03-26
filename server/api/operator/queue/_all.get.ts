import type { WorkQueueJob, WorkQueueResponse } from '../../../types/computed'

export default defineEventHandler(async () => {
  try {
    const { jobService, pathService, serialService } = getServices()
    const jobs = jobService.listJobs()

    const groupMap = new Map<string, WorkQueueJob>()

    for (const job of jobs) {
      const paths = pathService.listPathsByJob(job.id)

      for (const path of paths) {
        const totalSteps = path.steps.length

        for (const step of path.steps) {
          const serials = serialService.listSerialsByStepIndex(path.id, step.order)
          if (serials.length === 0 && step.order !== 0) continue

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
            serialIds: serials.map(s => s.id),
            partCount: serials.length,
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
      operatorId: '_all',
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
    throw createError({ statusCode: 500, message: 'Internal server error' })
  }
})
