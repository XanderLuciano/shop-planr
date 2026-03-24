export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { serialService, certService } = getServices()
    const serial = serialService.getSerial(id)
    const certs = certService.getCertsForSerial(id)
    return { ...serial, certs }
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
