defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Get webhook event queue statistics (total event count).',
    responses: {
      200: { description: 'Queue statistics' },
    },
  },
})

export default defineApiHandler(async () => {
  return getServices().webhookService.getQueueStats()
})
