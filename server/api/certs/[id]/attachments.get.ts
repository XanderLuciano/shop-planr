defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'List all part attachments for a certificate.',
    responses: {
      200: { description: 'List of attachments' },
      404: { description: 'Certificate not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { certService } = getServices()
  return certService.getAttachmentsByCertId(id)
})
