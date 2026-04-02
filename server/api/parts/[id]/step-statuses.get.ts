export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw createError({ statusCode: 400, message: 'Part ID is required' })

  const { lifecycleService } = getServices()
  const { paths } = getRepositories()

  // Get all routing entries and deduplicate by stepId, keeping the latest (highest sequenceNumber).
  // With append-only routing history, a step can have multiple entries (e.g., initial
  // 'pending' from initializeStepStatuses + 'completed' after advancement). The frontend
  // needs only the latest status per step.
  const allStatuses = lifecycleService.getStepStatuses(partId)
  const latestByStep = new Map<string, typeof allStatuses[number]>()
  for (const s of allStatuses) {
    const existing = latestByStep.get(s.stepId)
    if (!existing || s.sequenceNumber > existing.sequenceNumber) {
      latestByStep.set(s.stepId, s)
    }
  }

  // Get part to find path
  const { parts } = getRepositories()
  const part = parts.getById(partId)
  if (!part) throw createError({ statusCode: 404, message: 'Part not found' })

  const path = paths.getById(part.pathId)
  if (!path) {
    const statuses = [...latestByStep.values()]
    return statuses.map(s => ({ ...s, stepName: '', stepOrder: 0, optional: false, dependencyType: 'preferred', hasOverride: false }))
  }

  // Get overrides
  const { partStepOverrides } = getRepositories()
  const overrides = partStepOverrides.listByPartId(partId)
  const activeOverrideStepIds = new Set(overrides.filter(o => o.active).map(o => o.stepId))

  // Build one entry per path step, using the latest routing entry if available
  return path.steps.map(step => {
    const latest = latestByStep.get(step.id)
    return {
      stepId: step.id,
      stepName: step.name,
      stepOrder: step.order,
      status: latest?.status ?? 'pending',
      optional: step.optional,
      dependencyType: step.dependencyType,
      hasOverride: activeOverrideStepIds.has(step.id),
    }
  })
})
