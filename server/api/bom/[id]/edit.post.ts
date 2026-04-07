export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const userId = getAuthUserId(event)
  const { bomService } = getServices()
  return bomService.editBom(id, { ...body, userId })
})
