export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { pathService } = getServices()
  const path = pathService.getPath(id)
  const distribution = pathService.getStepDistribution(id, path)
  const completedCount = pathService.getPathCompletedCount(id, path)
  return { ...path, distribution, completedCount }
})
