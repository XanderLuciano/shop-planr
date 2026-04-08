import type { WorkQueueJob, WorkQueueGroup } from '../../types/computed'
import { findFirstActiveStep, shouldIncludeStep } from '../../utils/workQueueHelpers'
import { parseQuery } from '../../utils/validation'
import { workQueueQuerySchema } from '../../schemas/operatorSchemas'

export default defineApiHandler(async (event) => {
  const { groupBy } = parseQuery(event, workQueueQuerySchema)

  const { jobService, pathService, partService, userService } = getServices()
  const jobs = jobService.listJobs()

  // Build WorkQueueJob entries keyed by "jobId|pathId|stepOrder"
  const entries: { job: WorkQueueJob, assignedTo: string | undefined }[] = []

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length
      const firstActiveStep = findFirstActiveStep(path.steps)

      for (const step of path.steps) {
        if (step.removedAt) continue

        const parts = partService.listPartsByCurrentStepId(step.id)
        const isFirstActive = firstActiveStep != null && step.id === firstActiveStep.id

        if (!shouldIncludeStep(step, parts.length, isFirstActive, path.goalQuantity)) continue

        const isFinalStep = step.order === totalSteps - 1
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

        entries.push({
          assignedTo: step.assignedTo,
          job: {
            jobId: job.id,
            jobName: job.name,
            jobPriority: job.priority,
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
            isFinalStep,
            ...(isFirstActive && { goalQuantity: path.goalQuantity, completedCount: step.completedCount }),
          },
        })
      }
    }
  }

  // Build a userId → name lookup from all users
  const users = userService.listUsers()
  const userNameMap = new Map<string, string>()
  for (const u of users) {
    userNameMap.set(u.id, u.displayName)
  }

  // Group entries by the requested dimension
  const groups: WorkQueueGroup[] = groupEntriesByDimension(entries, groupBy, userNameMap)

  const totalParts = entries.reduce((sum, e) => sum + e.job.partCount, 0)

  return {
    groups,
    totalParts,
  }
})
