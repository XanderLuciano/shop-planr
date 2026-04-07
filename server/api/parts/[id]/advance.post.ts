export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  return partService.advancePart(id, userId)
})
