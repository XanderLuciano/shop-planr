export default defineEventHandler(async () => {
  try {
    const { partService } = getServices()
    return partService.listAllPartsEnriched()
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
