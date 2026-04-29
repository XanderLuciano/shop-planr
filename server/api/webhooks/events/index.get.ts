import { listEventsQuerySchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List webhook events with delivery summaries and optional pagination (limit, offset query params).',
    responses: {
      200: { description: 'Array of webhook events with delivery summaries' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { limit, offset } = parseQuery(event, listEventsQuerySchema)
  return getServices().webhookService.listEventsWithDeliveries({ limit, offset })
})
