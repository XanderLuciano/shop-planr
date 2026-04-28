defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'Create a new certificate.',
    responses: {
      201: { description: 'Certificate created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { certService } = getServices()
  return certService.createCert(body)
})
