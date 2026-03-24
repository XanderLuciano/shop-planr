export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { certService } = getServices()
    return certService.getAttachmentsByCertId(id)
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
