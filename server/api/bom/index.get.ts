export default defineApiHandler(async (event) => {
  const query = getQuery(event)
  const includeArchived = query.includeArchived === 'true'
  const { bomService } = getServices()
  return bomService.listBoms(includeArchived)
})
