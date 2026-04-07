export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.createStepOverride(body.partIds || body.serialIds, body.stepId, body.reason, userId)
})
