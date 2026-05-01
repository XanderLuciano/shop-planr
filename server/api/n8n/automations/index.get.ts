defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'List all n8n automations.',
    responses: {
      200: { description: 'Array of N8nAutomation objects' },
    },
  },
})

export default defineApiHandler(async (_event) => {
  return getServices().n8nAutomationService.list()
})
