import type { WorkQueueJob, OperatorGroup, WorkQueueGroupedResponse } from '../../types/computed'

export default defineEventHandler(async () => {
  try {
    const { jobService, pathService, partService, userService } = getServices()
    const jobs = jobService.listJobs()

    // Build WorkQueueJob entries keyed by "jobId|pathId|stepOrder"
    const entries: { job: WorkQueueJob; assignedTo: string | undefined }[] = []

    for (const job of jobs) {
      const paths = pathService.listPathsByJob(job.id)

      for (const path of paths) {
        const totalSteps = path.steps.length

        for (const step of path.steps) {
          const parts = partService.listPartsByStepIndex(path.id, step.order)
          if (parts.length === 0) continue

          const isFinalStep = step.order === totalSteps - 1
          const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]

          entries.push({
            assignedTo: step.assignedTo,
            job: {
              jobId: job.id,
              jobName: job.name,
              pathId: path.id,
              pathName: path.name,
              stepId: step.id,
              stepName: step.name,
              stepOrder: step.order,
              stepLocation: step.location,
              totalSteps,
              partIds: parts.map((s) => s.id),
              partCount: parts.length,
              nextStepName: nextStep?.name,
              nextStepLocation: nextStep?.location,
              isFinalStep,
            },
          })
        }
      }
    }

    // Build a userId → name lookup from all users
    const users = userService.listUsers()
    const userNameMap = new Map<string, string>()
    for (const u of users) {
      userNameMap.set(u.id, u.name)
    }

    // Group entries by assignedTo
    const groupMap = new Map<string | null, WorkQueueJob[]>()

    for (const entry of entries) {
      const key = entry.assignedTo ?? null
      const list = groupMap.get(key)
      if (list) {
        list.push(entry.job)
      } else {
        groupMap.set(key, [entry.job])
      }
    }

    // Convert to OperatorGroup array
    const groups: OperatorGroup[] = []

    for (const [operatorId, groupJobs] of groupMap) {
      const totalParts = groupJobs.reduce((sum, j) => sum + j.partCount, 0)
      const operatorName = operatorId ? (userNameMap.get(operatorId) ?? operatorId) : 'Unassigned'

      groups.push({
        operatorId,
        operatorName,
        jobs: groupJobs,
        totalParts,
      })
    }

    const totalParts = entries.reduce((sum, e) => sum + e.job.partCount, 0)

    const response: WorkQueueGroupedResponse = {
      groups,
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
