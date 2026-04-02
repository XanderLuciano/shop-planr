import type { WorkQueueJob, StepViewResponse } from '../../../types/computed'

export default defineEventHandler(async (event) => {
  try {
    const stepId = getRouterParam(event, 'stepId')
    if (!stepId) {
      throw new ValidationError('stepId is required')
    }

    const { jobService, pathService, partService, noteService } = getServices()
    const jobs = jobService.listJobs()

    let foundJob: WorkQueueJob | null = null
    let previousStepWipCount: number | undefined

    for (const job of jobs) {
      if (foundJob) break
      const paths = pathService.listPathsByJob(job.id)

      for (const path of paths) {
        if (foundJob) break
        const totalSteps = path.steps.length

        for (const step of path.steps) {
          if (step.id !== stepId) continue

          const parts = partService.listPartsByCurrentStepId(step.id)

          const isFinalStep = step.order === totalSteps - 1
          const prevStep = step.order > 0 ? path.steps[step.order - 1] : undefined
          const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

          // For non-first steps with zero parts, look up previous step's WIP count
          if (step.order > 0 && parts.length === 0 && prevStep) {
            const prevParts = partService.listPartsByCurrentStepId(prevStep.id)
            previousStepWipCount = prevParts.length
          }

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
            partIds: parts.map(s => s.id),
            partCount: parts.length,
            previousStepId: prevStep?.id,
            previousStepName: prevStep?.name,
            nextStepId: nextStep?.id,
            nextStepName: nextStep?.name,
            nextStepLocation: nextStep?.location,
            isFinalStep,
            stepOptional: step.optional ?? false,
          }
          break
        }
      }
    }

    if (!foundJob) {
      throw new NotFoundError('ProcessStep', stepId)
    }

    const notes = noteService.getNotesForStep(stepId)

    const response: StepViewResponse = {
      job: foundJob,
      notes,
      ...(previousStepWipCount !== undefined && { previousStepWipCount }),
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
