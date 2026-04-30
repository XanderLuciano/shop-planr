import { listQueuedQuerySchema } from '../../../schemas/webhookSchemas'

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
  const userId = getAuthUserId(event)
  requireAdmin(getRepositories().users, userId, 'list queued webhook deliveries')
  const { limit } = parseQuery(event, listQueuedQuerySchema)
  const { webhookDeliveryService } = getServices()
  return webhookDeliveryService.listQueued(limit)
})
