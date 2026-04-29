defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List all webhook registrations.',
    responses: {
      200: { description: 'Array of webhook registrations' },
    },
  },
})

export default defineApiHandler(async () => {
  const { webhookRegistrationService } = getServices()
  return webhookRegistrationService.list()
})
