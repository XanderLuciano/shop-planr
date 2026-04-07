import { updateStepConfigSchema } from '../../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const stepId = getRouterParam(event, 'id')
  if (!stepId) throw new ValidationError('Step ID is required')

  const body = await parseBody(event, updateStepConfigSchema)
  const { pathService } = getServices()

  const update: Record<string, unknown> = {}
  if (typeof body.optional === 'boolean') update.optional = body.optional
  if (typeof body.location === 'string') {
    const trimmed = body.location.trim()
    update.location = trimmed || undefined
  }
  if (body.dependencyType) update.dependencyType = body.dependencyType

  return pathService.updateStep(stepId, update)
})
