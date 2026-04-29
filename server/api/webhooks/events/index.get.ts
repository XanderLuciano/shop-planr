import { listEventsQuerySchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List webhook events with optional pagination (limit, offset query params).',
    responses: {
      200: { description: 'Array of webhook events' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { limit, offset } = parseQuery(event, listEventsQuerySchema)
  return getServices().webhookService.listEvents({ limit, offset })
})
