defineRouteMeta({
  openAPI: {
    tags: ['Audit'],
    description: 'Get the audit trail for a specific part.',
    responses: {
      200: { description: 'Part audit trail' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { auditService } = getServices()
  return auditService.getPartAuditTrail(id)
})
