defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Get a single n8n automation by ID.',
    responses: {
      200: { description: 'N8nAutomation object' },
      404: { description: 'Automation not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  return getServices().n8nAutomationService.getById(id)
})
