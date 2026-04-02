export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { bomService } = getServices()
  return bomService.editBom(id, body)
})
