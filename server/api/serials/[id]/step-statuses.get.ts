export default defineEventHandler(async (event) => {
  const serialId = getRouterParam(event, 'id')
  if (!serialId) throw createError({ statusCode: 400, message: 'Serial ID is required' })

  const { lifecycleService } = getServices()
  const { paths } = getRepositories()

  // Get step statuses
  const statuses = lifecycleService.getStepStatuses(serialId)

  // Get serial to find path
  const { serials } = getRepositories()
  const serial = serials.getById(serialId)
  if (!serial) throw createError({ statusCode: 404, message: 'Serial not found' })

  const path = paths.getById(serial.pathId)
  if (!path) return statuses.map(s => ({ ...s, stepName: '', stepOrder: 0, optional: false, dependencyType: 'preferred', hasOverride: false }))

  // Get overrides
  const { snStepOverrides } = getRepositories()
  const overrides = snStepOverrides.listBySerialId(serialId)
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
