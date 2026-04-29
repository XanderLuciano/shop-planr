import { batchAdvanceToSchema } from '../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Batch-advance multiple parts to a specific target step.',
    requestBody: zodRequestBody(batchAdvanceToSchema),
    responses: {
      200: { description: 'Batch advance-to results' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchAdvanceToSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  const userName = resolveUserName(userId)

  const results: { partId: string, success: boolean, error?: string }[] = []
  let advanced = 0
  let failed = 0

  for (const partId of body.partIds) {
    try {
      const result = lifecycleService.advanceToStep(partId, {
        targetStepId: body.targetStepId,
        skip: body.skip,
        userId,
      })
      results.push({ partId, success: true })
      advanced++
      const eventType = result.serial.status === 'completed' ? 'part_completed' : 'part_advanced'
      emitWebhookEvent(eventType, {
        user: userName,
        partId,
        targetStepId: body.targetStepId,
        skip: body.skip ?? false,
        newStatus: result.serial.status,
      })
      // Emit step_skipped / step_deferred for any bypassed steps
      for (const bypassed of result.bypassed) {
        if (bypassed.classification === 'skipped') {
          emitWebhookEvent('step_skipped', {
            user: userName,
            partId,
            stepId: bypassed.stepId,
            stepName: bypassed.stepName,
          })
        } else if (bypassed.classification === 'deferred') {
          emitWebhookEvent('step_deferred', {
            user: userName,
            partId,
            stepId: bypassed.stepId,
            stepName: bypassed.stepName,
          })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.push({ partId, success: false, error: message })
      failed++
    }
  }

  return { advanced, failed, results }
})
