defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Get a part by ID with its certificates.',
    responses: {
      200: { description: 'Part details' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { partService, certService } = getServices()
  const part = partService.getPart(id)
  const certs = certService.getCertsForSerial(id)
  return { ...part, certs }
})
