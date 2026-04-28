defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Waive a step for a part (skip with approval).',
    responses: {
      200: { description: 'Step waived' },
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
  return lifecycleService.waiveStep(id, stepId, { ...await readBody(event), approverId: userId })
})
