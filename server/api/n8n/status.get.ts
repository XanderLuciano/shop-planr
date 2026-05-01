defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Check the connection status of the configured n8n instance.',
    responses: {
      200: { description: 'Connection status with baseUrl and optional error message' },
    },
  },
})

export default defineApiHandler(async (_event) => {
  return await getServices().n8nAutomationService.getN8nStatus()
})
