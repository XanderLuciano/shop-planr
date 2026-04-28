defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'List version history for a BOM.',
    responses: {
      200: { description: 'List of BOM versions' },
      404: { description: 'BOM not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { bomService } = getServices()
  return bomService.listBomVersions(id)
})
