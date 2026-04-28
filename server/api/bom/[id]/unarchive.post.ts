export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { bomService } = getServices()
  return bomService.unarchiveBom(id, userId)
})
