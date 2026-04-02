import type { FullRouteResponse, FullRouteEntry } from '../../../types/computed'
import type { PartStepStatus, ProcessStep } from '../../../types/domain'

export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) {
    throw new ValidationError('partId is required')
  }

  const { partService, pathService, lifecycleService } = getServices()
  const repos = getRepositories()

  // 1. Get the part
  const part = partService.getPart(partId)

  // 2. Get the path (active steps only)
  const path = pathService.getPath(part.pathId)

  // 3. Get all routing history entries ordered by sequenceNumber
  const routingEntries = lifecycleService.getStepStatuses(partId)

  // 4. Build a set of step IDs that have routing entries
  const routingByStepId = new Map<string, PartStepStatus[]>()
  for (const entry of routingEntries) {
    const list = routingByStepId.get(entry.stepId) ?? []
    list.push(entry)
    routingByStepId.set(entry.stepId, list)
  }

  // 5. Build a lookup for active steps by ID
  const activeStepMap = new Map<string, ProcessStep>()
  for (const step of path.steps) {
    activeStepMap.set(step.id, step)
  }

  // 6. Resolve step details for routing entries (including soft-deleted steps)
  const stepCache = new Map<string, ProcessStep>()
  for (const step of path.steps) {
    stepCache.set(step.id, step)
  }
  for (const entry of routingEntries) {
    if (!stepCache.has(entry.stepId)) {
      const step = repos.paths.getStepByIdIncludeRemoved(entry.stepId)
      if (step) stepCache.set(entry.stepId, step)
    }
  }

  const isCompleted = part.currentStepId === null
  const currentStep = part.currentStepId ? activeStepMap.get(part.currentStepId) : undefined
  const currentOrder = currentStep?.order

  const entries: FullRouteEntry[] = []

  // 7. Build entries from routing history (historical + current)
  for (const entry of routingEntries) {
    const step = stepCache.get(entry.stepId)
    if (!step) continue

    const isRemoved = !!step.removedAt
    const isCurrent = !isCompleted && entry.stepId === part.currentStepId
      && entry.status === 'in_progress'
      && entry === routingByStepId.get(entry.stepId)?.at(-1)

    entries.push({
      stepId: entry.stepId,
      stepName: step.name,
      stepOrder: step.order,
      location: step.location,
      assignedTo: step.assignedTo,
      sequenceNumber: entry.sequenceNumber,
      status: entry.status,
      enteredAt: entry.enteredAt,
      completedAt: entry.completedAt,
      isCurrent,
      isPlanned: false,
      isRemoved,
    })
  }

  // 8. Handle N/A and planned steps from active path steps
  for (const step of path.steps) {
    const hasRouting = routingByStepId.has(step.id)
    if (hasRouting) continue

    if (isCompleted) {
      entries.push({
        stepId: step.id,
        stepName: step.name,
        stepOrder: step.order,
        location: step.location,
        assignedTo: step.assignedTo,
        status: 'na',
        isCurrent: false,
        isPlanned: false,
        isRemoved: false,
      })
    } else if (currentOrder !== undefined && step.order < currentOrder) {
      entries.push({
        stepId: step.id,
        stepName: step.name,
        stepOrder: step.order,
        location: step.location,
        assignedTo: step.assignedTo,
        status: 'na',
        isCurrent: false,
        isPlanned: false,
        isRemoved: false,
      })
    } else if (currentOrder !== undefined && step.order > currentOrder) {
      entries.push({
        stepId: step.id,
        stepName: step.name,
        stepOrder: step.order,
        location: step.location,
        assignedTo: step.assignedTo,
        status: 'pending',
        isCurrent: false,
        isPlanned: true,
        isRemoved: false,
      })
    }
  }

  // 9. Sort: historical (by sequenceNumber), then N/A (by stepOrder), then planned (by stepOrder)
  entries.sort((a, b) => {
    if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
      return a.sequenceNumber - b.sequenceNumber
    }
    if (a.sequenceNumber !== undefined) return -1
    if (b.sequenceNumber !== undefined) return 1
    if (a.status === 'na' && b.isPlanned) return -1
    if (a.isPlanned && b.status === 'na') return 1
    return a.stepOrder - b.stepOrder
  })

  const response: FullRouteResponse = {
    partId,
    isCompleted,
    entries,
  }

  return response
})
