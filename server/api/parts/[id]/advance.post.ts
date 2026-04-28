defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Advance a single part to its next step.',
    responses: {
      200: { description: 'Part advanced' },
      400: { description: 'Part cannot be advanced' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  return partService.advancePart(id, userId)
})
