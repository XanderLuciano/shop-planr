export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const stepId = getRouterParam(event, 'stepId')!
  const body = await readBody(event)
  const { lifecycleService } = getServices()
  lifecycleService.reverseStepOverride(id, stepId, body.userId)
  return { success: true }
})
