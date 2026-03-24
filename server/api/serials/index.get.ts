export default defineEventHandler(async () => {
  try {
    const { serialService } = getServices()
    return serialService.listAllSerialsEnriched()
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
