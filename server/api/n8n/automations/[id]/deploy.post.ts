defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Deploy an automation to the configured n8n instance (admin only). Creates or updates the workflow and activates it if enabled.',
    responses: {
      200: { description: 'Updated N8nAutomation with n8nWorkflowId and linkedRegistrationId populated' },
      400: { description: 'n8n not configured or deploy failed' },
      403: { description: 'Admin access required' },
      404: { description: 'Automation not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  const userId = getAuthUserId(event)
  return await getServices().n8nAutomationService.deploy(id, userId)
})
