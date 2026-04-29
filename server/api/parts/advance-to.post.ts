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

  // Collect part IDs by outcome for batched webhook events
  const advancedPartIds: string[] = []
  const completedPartIds: string[] = []
  const skippedSteps = new Map<string, { stepName: string, partIds: string[] }>()
  const deferredSteps = new Map<string, { stepName: string, partIds: string[] }>()

  for (const partId of body.partIds) {
    try {
      const result = lifecycleService.advanceToStep(partId, {
        targetStepId: body.targetStepId,
        skip: body.skip,
        userId,
      })
      results.push({ partId, success: true })
      advanced++

      if (result.serial.status === 'completed') {
        completedPartIds.push(partId)
      } else {
        advancedPartIds.push(partId)
      }

      // Collect bypassed steps grouped by stepId
      for (const bypassed of result.bypassed) {
        const map = bypassed.classification === 'skipped' ? skippedSteps : deferredSteps
        const existing = map.get(bypassed.stepId)
        if (existing) {
          existing.partIds.push(partId)
        } else {
          map.set(bypassed.stepId, { stepName: bypassed.stepName, partIds: [partId] })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.push({ partId, success: false, error: message })
      failed++
    }
  }

  // Emit batched webhook events
  if (advancedPartIds.length > 0) {
    emitWebhookEvent('part_advanced', {
      user: userName,
      partIds: advancedPartIds,
      advancedCount: advancedPartIds.length,
      failedCount: failed,
      targetStepId: body.targetStepId,
      skip: body.skip ?? false,
    })
  }

  if (completedPartIds.length > 0) {
    emitWebhookEvent('part_completed', {
      user: userName,
      partIds: completedPartIds,
      count: completedPartIds.length,
      targetStepId: body.targetStepId,
    })
  }

  for (const [stepId, { stepName, partIds }] of skippedSteps) {
    emitWebhookEvent('step_skipped', {
      user: userName,
      partIds,
      count: partIds.length,
      stepId,
      stepName,
    })
  }

  for (const [stepId, { stepName, partIds }] of deferredSteps) {
    emitWebhookEvent('step_deferred', {
      user: userName,
      partIds,
      count: partIds.length,
      stepId,
      stepName,
    })
  }

  return { advanced, failed, results }
})
