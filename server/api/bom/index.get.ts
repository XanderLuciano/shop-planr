defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'List all bills of materials.',
    responses: {
      200: { description: 'List of BOMs' },
    },
  },
})

export default defineApiHandler(async () => {
  const { bomService } = getServices()
  return bomService.listBoms()
})
