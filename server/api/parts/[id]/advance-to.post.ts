export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { lifecycleService } = getServices()
  return lifecycleService.advanceToStep(id, body)
})
