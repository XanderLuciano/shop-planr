defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Get certificate attachments for a part.',
    responses: {
      200: { description: 'List of certificate attachments' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw new ValidationError('Part ID is required')

  const { certService } = getServices()
  return certService.getAttachmentsBySerialId(partId)
})
