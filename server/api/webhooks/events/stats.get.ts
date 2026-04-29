defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Get webhook event queue statistics (counts by status: queued, sent, failed).',
    responses: {
      200: { description: 'Queue statistics' },
    },
  },
})

export default defineApiHandler(async () => {
  return getServices().webhookService.getQueueStats()
})
