defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Reverse (delete) a step override for a part.',
    responses: {
      200: { description: 'Step override reversed' },
      404: { description: 'Part or override not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const stepId = getRouterParam(event, 'stepId')!
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  lifecycleService.reverseStepOverride(id, stepId, userId)
  emitWebhookEvent('step_override_reversed', {
    user: resolveUserName(userId),
    partId: id,
    stepId,
    stepName: resolveStepName(id, stepId),
  })
  return { success: true }
})
