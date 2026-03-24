export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const { templateService } = getServices()
    return templateService.applyTemplate(id, body)
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
