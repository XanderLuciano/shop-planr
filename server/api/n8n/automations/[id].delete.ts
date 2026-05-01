defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Delete an n8n automation and its linked registration (admin only).',
    responses: {
      200: { description: 'Deletion confirmation' },
      403: { description: 'Admin access required' },
      404: { description: 'Automation not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  const userId = getAuthUserId(event)
  getServices().n8nAutomationService.delete(id, userId)
  return { success: true }
})
