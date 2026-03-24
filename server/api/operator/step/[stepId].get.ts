import type { WorkQueueJob, StepViewResponse } from '../../../types/computed'

export default defineEventHandler(async (event) => {
  try {
    const stepId = getRouterParam(event, 'stepId')
    if (!stepId) {
      throw new ValidationError('stepId is required')
    }

    const { jobService, pathService, serialService, noteService } = getServices()
    const jobs = jobService.listJobs()

    let foundJob: WorkQueueJob | null = null

    for (const job of jobs) {
      if (foundJob) break
      const paths = pathService.listPathsByJob(job.id)

      for (const path of paths) {
        if (foundJob) break
        const totalSteps = path.steps.length

        for (const step of path.steps) {
          if (step.id !== stepId) continue

          const serials = serialService.listSerialsByStepIndex(path.id, step.order)
          if (serials.length === 0) {
            throw new NotFoundError('No active parts at this step')
          }

          const isFinalStep = step.order === totalSteps - 1
          const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

          foundJob = {
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
          }
          break
        }
      }
    }

    if (!foundJob) {
      throw new NotFoundError('ProcessStep not found')
    }

    const notes = noteService.getNotesForStep(stepId)

    const response: StepViewResponse = {
      job: foundJob,
      notes,
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
