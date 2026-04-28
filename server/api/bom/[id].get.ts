defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'Get a BOM by ID with its summary.',
    responses: {
      200: { description: 'BOM details' },
      404: { description: 'BOM not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { bomService } = getServices()
  const bom = bomService.getBom(id)
  const summary = bomService.getBomSummary(id)
  return { ...bom, summary }
})
