defineRouteMeta({
  openAPI: {
    tags: ['Audit'],
    description: 'List audit entries with optional pagination.',
    responses: {
      200: { description: 'List of audit entries' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : undefined
  const offset = query.offset ? Number(query.offset) : undefined
  const { auditService } = getServices()
  return auditService.listAuditEntries({ limit, offset })
})
