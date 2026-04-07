export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const stepId = getRouterParam(event, 'stepId')!
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.completeDeferredStep(id, stepId, userId)
})
