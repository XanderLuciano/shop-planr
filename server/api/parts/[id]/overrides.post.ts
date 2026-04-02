export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { lifecycleService } = getServices()
  return lifecycleService.createStepOverride(body.partIds || body.serialIds, body.stepId, body.reason, body.userId)
})
