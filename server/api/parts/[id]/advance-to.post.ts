import { advanceToStepSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Advance a part to a specific target step.',
    requestBody: zodRequestBody(advanceToStepSchema),
    responses: {
      200: { description: 'Part advanced to target step' },
      400: { description: 'Validation error' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, advanceToStepSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  const result = lifecycleService.advanceToStep(id, { ...body, userId })
  const userName = resolveUserName(userId)
  const eventType = result.serial.status === 'completed' ? 'part_completed' : 'part_advanced'
  emitWebhookEvent(eventType, {
    user: userName,
    partId: id,
    targetStepId: body.targetStepId,
    skip: body.skip ?? false,
    newStatus: result.serial.status,
  })
  // Emit step_skipped / step_deferred for any bypassed steps during advancement
  for (const bypassed of result.bypassed) {
    if (bypassed.classification === 'skipped') {
      emitWebhookEvent('step_skipped', {
        user: userName,
        partId: id,
        stepId: bypassed.stepId,
        stepName: bypassed.stepName,
      })
    } else if (bypassed.classification === 'deferred') {
      emitWebhookEvent('step_deferred', {
        user: userName,
        partId: id,
        stepId: bypassed.stepId,
        stepName: bypassed.stepName,
      })
    }
  }
  return result
})
