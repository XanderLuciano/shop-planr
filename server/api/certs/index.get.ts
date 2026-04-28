defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'List all certificates.',
    responses: {
      200: { description: 'List of certificates' },
    },
  },
})

export default defineApiHandler(async () => {
  const { certService } = getServices()
  return certService.listCerts()
})
