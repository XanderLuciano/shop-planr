defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'Get a certificate by ID.',
    responses: {
      200: { description: 'Certificate details' },
      404: { description: 'Certificate not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { certService } = getServices()
  return certService.getCert(id)
})
