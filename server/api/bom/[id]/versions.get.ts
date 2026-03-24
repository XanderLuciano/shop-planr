export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { bomService } = getServices()
    return bomService.listBomVersions(id)
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
