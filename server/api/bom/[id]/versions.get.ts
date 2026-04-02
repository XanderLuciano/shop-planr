export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { bomService } = getServices()
  return bomService.listBomVersions(id)
})
