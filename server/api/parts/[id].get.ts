export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { partService, certService } = getServices()
    const part = partService.getPart(id)
    const certs = certService.getCertsForSerial(id)
    return { ...part, certs }
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
