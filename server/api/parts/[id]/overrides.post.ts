import { createOverrideSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Create a step override for one or more parts.',
    requestBody: zodRequestBody(createOverrideSchema),
    responses: {
      200: { description: 'Step override created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createOverrideSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  const partIds = body.partIds || body.serialIds!
  const result = lifecycleService.createStepOverride(partIds, body.stepId, body.reason, userId)
  const firstPartId = partIds[0]
  emitWebhookEvent('step_override_created', {
    user: resolveUserName(userId),
    partIds,
    count: partIds.length,
    stepId: body.stepId,
    stepName: firstPartId ? resolveStepName(firstPartId, body.stepId) : undefined,
    reason: body.reason,
    ...(firstPartId ? resolvePathInfo(firstPartId) : {}),
  })
  return result
})
