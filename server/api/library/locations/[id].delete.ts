export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { libraryService } = getServices()
    libraryService.removeLocation(id)
    return { success: true }
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
