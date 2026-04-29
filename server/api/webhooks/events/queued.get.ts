import { limitQuerySchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List queued webhook events (status = queued). Optional limit query param.',
    responses: {
      200: { description: 'Array of queued webhook events' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { limit } = parseQuery(event, limitQuerySchema)
  return getServices().webhookService.listQueuedEvents(limit)
})
