export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { pathService } = getServices()
  pathService.deletePath(id)
  return { success: true }
})
