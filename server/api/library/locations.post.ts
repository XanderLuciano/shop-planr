export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { libraryService } = getServices()
    return libraryService.addLocation(body.name)
  } catch (error) {
    if (error instanceof ValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    throw error
  }
})
