export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { auditService } = getServices()
  return auditService.getPartAuditTrail(id)
})
