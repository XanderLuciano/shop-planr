export default defineEventHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw createError({ statusCode: 400, message: 'Part ID is required' })

  const { lifecycleService } = getServices()
  const { paths } = getRepositories()

  // Get step statuses
  const statuses = lifecycleService.getStepStatuses(partId)

  // Get part to find path
  const { parts } = getRepositories()
  const part = parts.getById(partId)
  if (!part) throw createError({ statusCode: 404, message: 'Part not found' })

  const path = paths.getById(part.pathId)
  if (!path) return statuses.map(s => ({ ...s, stepName: '', stepOrder: 0, optional: false, dependencyType: 'preferred', hasOverride: false }))

  // Get overrides
  const { partStepOverrides } = getRepositories()
  const overrides = partStepOverrides.listByPartId(partId)
  const activeOverrideStepIds = new Set(overrides.filter(o => o.active).map(o => o.stepId))

  // Enrich with step info
  return statuses.map(s => {
    const step = path.steps.find(ps => ps.id === s.stepId)
    return {
      stepId: s.stepId,
      stepName: step?.name ?? '',
      stepOrder: step?.order ?? s.stepIndex,
      status: s.status,
      optional: step?.optional ?? false,
      dependencyType: step?.dependencyType ?? 'preferred',
      hasOverride: activeOverrideStepIds.has(s.stepId),
    }
  })
})
