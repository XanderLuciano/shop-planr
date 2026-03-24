export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { templateService } = getServices()
    const deleted = templateService.deleteTemplate(id)
    if (!deleted) {
      throw new NotFoundError('TemplateRoute', id)
    }
    return { success: true }
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
