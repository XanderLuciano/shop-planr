export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw createError({ statusCode: 400, message: 'Part ID is required' })

  const { certService } = getServices()
  return certService.getAttachmentsBySerialId(partId)
})
