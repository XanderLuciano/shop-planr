export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { libraryService } = getServices()
    return libraryService.addProcess(body.name)
  } catch (error) {
    if (error instanceof ValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    throw error
  }
})
