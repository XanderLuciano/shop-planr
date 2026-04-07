export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const stepId = getRouterParam(event, 'stepId')!
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.waiveStep(id, stepId, { ...await readBody(event), approverId: userId })
})
