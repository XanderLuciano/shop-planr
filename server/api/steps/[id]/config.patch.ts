export default defineEventHandler(async (event) => {
  const stepId = getRouterParam(event, 'id')
  if (!stepId) throw createError({ statusCode: 400, message: 'Step ID is required' })

  const body = await readBody(event)
  const { pathService } = getServices()

  const update: Record<string, unknown> = {}
  if (typeof body.optional === 'boolean') update.optional = body.optional
  if (body.dependencyType && ['physical', 'preferred', 'completion_gate'].includes(body.dependencyType)) {
    update.dependencyType = body.dependencyType
  }

  if (!Object.keys(update).length) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const result = pathService.updateStep(stepId, update)
  return result
})
