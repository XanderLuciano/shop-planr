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
  emitWebhookEvent('step_override_created', {
    user: resolveUserName(userId),
    partIds,
    count: partIds.length,
    stepId: body.stepId,
    stepName: partIds.length > 0 ? resolveStepName(partIds[0]!, body.stepId) : undefined,
    reason: body.reason,
  })
  return result
})
