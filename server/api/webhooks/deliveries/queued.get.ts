defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List queued deliveries with registration URLs for the dispatch engine.',
    responses: {
      200: { description: 'Array of queued delivery views' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : undefined
  const { webhookDeliveryService } = getServices()
  return webhookDeliveryService.listQueued(limit)
})
