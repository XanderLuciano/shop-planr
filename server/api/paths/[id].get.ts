export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { pathService } = getServices()
    const path = pathService.getPath(id)
    const distribution = pathService.getStepDistribution(id)
    const completedCount = pathService.getPathCompletedCount(id)
    return { ...path, distribution, completedCount }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
