export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { bomService } = getServices()
  const bom = bomService.getBom(id)
  const summary = bomService.getBomSummary(id)
  return { ...bom, summary }
})
