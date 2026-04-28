defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'Unarchive a bill of materials.',
    responses: {
      200: { description: 'BOM unarchived' },
      404: { description: 'BOM not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { bomService } = getServices()
  return bomService.unarchiveBom(id, userId)
})
