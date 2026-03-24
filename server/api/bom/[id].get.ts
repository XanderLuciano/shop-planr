export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { bomService } = getServices()
    const bom = bomService.getBom(id)
    const summary = bomService.getBomSummary(id)
    return { ...bom, summary }
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
