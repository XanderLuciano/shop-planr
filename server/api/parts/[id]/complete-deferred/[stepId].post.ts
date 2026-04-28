defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Complete a previously deferred step for a part.',
    responses: {
      200: { description: 'Deferred step completed' },
      400: { description: 'Validation error' },
      404: { description: 'Part or step not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const stepId = getRouterParam(event, 'stepId')!
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.completeDeferredStep(id, stepId, userId)
})
