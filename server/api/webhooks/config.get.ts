defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Get the current webhook configuration (endpoint URL, enabled event types, active flag).',
    responses: {
      200: { description: 'Webhook configuration' },
    },
  },
})

export default defineApiHandler(async () => {
  return getServices().webhookService.getConfig()
})
