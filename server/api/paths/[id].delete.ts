defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Delete a path by ID (admin only, cascades dependents).',
    responses: {
      200: { description: 'Path deleted' },
      403: { description: 'Forbidden — admin required' },
      404: { description: 'Path not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { pathService } = getServices()
  const result = pathService.deletePath(id, userId)
  return { success: true, ...result }
})
