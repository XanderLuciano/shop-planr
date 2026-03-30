export default defineEventHandler((event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { jobService } = getServices()
    jobService.deleteJob(id)
    setResponseStatus(event, 204)
    return null
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
