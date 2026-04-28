defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Get a path by ID with step distribution and completed count.',
    responses: {
      200: { description: 'Path details' },
      404: { description: 'Path not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { pathService } = getServices()
  const path = pathService.getPath(id)
  const distribution = pathService.getStepDistribution(id, path)
  const completedCount = pathService.getPathCompletedCount(id, path)
  return { ...path, distribution, completedCount }
})
