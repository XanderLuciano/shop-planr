defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'Archive a bill of materials.',
    responses: {
      200: { description: 'BOM archived' },
      404: { description: 'BOM not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { bomService } = getServices()
  return bomService.archiveBom(id, userId)
})
