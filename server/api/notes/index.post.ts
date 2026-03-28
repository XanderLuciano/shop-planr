export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      jobId: string
      pathId: string
      stepId: string
      partIds: string[]
      text: string
      userId: string
    }>(event)
    const { noteService } = getServices()
    return noteService.createNote(body)
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
