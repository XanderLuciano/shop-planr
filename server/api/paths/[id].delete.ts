export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { pathService } = getServices()
  const result = pathService.deletePath(id, userId)
  return { success: true, ...result }
})
