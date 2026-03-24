export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { jobService, pathService } = getServices()
    const job = jobService.getJob(id)
    const paths = pathService.listPathsByJob(id)
    const progress = jobService.computeJobProgress(id)
    return { ...job, paths, progress }
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
