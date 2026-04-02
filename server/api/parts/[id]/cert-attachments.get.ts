export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw new ValidationError('Part ID is required')

  const { certService } = getServices()
  return certService.getAttachmentsBySerialId(partId)
})
