import type { WorkQueueJob, WorkQueueResponse } from '../../../types/computed'
import { findFirstActiveStep, shouldIncludeStep } from '../../../utils/workQueueHelpers'

export default defineApiHandler(async () => {
  const { jobService, pathService, partService } = getServices()
  const jobs = jobService.listJobs()

  const groupMap = new Map<string, WorkQueueJob>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length
      const firstActiveStep = findFirstActiveStep(path.steps)

      const pathSteps = path.steps.filter(s => !s.removedAt).map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        location: s.location,
        optional: s.optional,
      }))

      for (const step of path.steps) {
        if (step.removedAt) continue

        const parts = partService.listPartsByCurrentStepId(step.id)
        const isFirstActive = firstActiveStep != null && step.id === firstActiveStep.id

        if (!shouldIncludeStep(step, parts.length, isFirstActive, path.goalQuantity)) continue

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
          assignedTo: step.assignedTo,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          nextStepAssignedTo: nextStep?.assignedTo,
          isFinalStep,
          jobPriority: job.priority,
          pathAdvancementMode: path.advancementMode,
          pathSteps,
          ...(isFirstActive && { goalQuantity: path.goalQuantity, completedCount: step.completedCount }),
        })
      }
    }
  }

  const queueJobs = Array.from(groupMap.values())
  const totalParts = queueJobs.reduce((sum, j) => sum + j.partCount, 0)

  const response: WorkQueueResponse = {
    jobs: queueJobs,
    totalParts,
  }

  return response
})
