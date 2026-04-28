defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'List all parts with enriched data.',
    responses: {
      200: { description: 'List of parts' },
    },
  },
})

export default defineApiHandler(async () => {
  const { partService } = getServices()
  return partService.listAllPartsEnriched()
})
