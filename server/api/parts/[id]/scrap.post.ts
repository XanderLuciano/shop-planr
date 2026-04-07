export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.scrapPart(id, { ...body, userId })
})
