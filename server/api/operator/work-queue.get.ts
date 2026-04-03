import type { WorkQueueJob, WorkQueueGroup, GroupByDimension } from '../../types/computed'

const VALID_GROUP_BY: GroupByDimension[] = ['user', 'location', 'step']

export default defineApiHandler(async (event) => {
  const query = getQuery(event)
  const rawGroupBy = query.groupBy as string | undefined
  const groupBy: GroupByDimension = VALID_GROUP_BY.includes(rawGroupBy as GroupByDimension)
    ? (rawGroupBy as GroupByDimension)
    : 'location'

  const { jobService, pathService, partService, userService } = getServices()
  const jobs = jobService.listJobs()

  // Build WorkQueueJob entries keyed by "jobId|pathId|stepOrder"
  const entries: { job: WorkQueueJob, assignedTo: string | undefined }[] = []

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)

    for (const path of paths) {
      const totalSteps = path.steps.length

      for (const step of path.steps) {
        const parts = partService.listPartsByCurrentStepId(step.id)
        if (parts.length === 0) continue

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
