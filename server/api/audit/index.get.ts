export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = query.limit ? Number(query.limit) : undefined
    const offset = query.offset ? Number(query.offset) : undefined
    const { auditService } = getServices()
    return auditService.listAuditEntries({ limit, offset })
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
