import { queueEventSchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Queue a new webhook event for dispatch.',
    requestBody: zodRequestBody(queueEventSchema),
    responses: {
      200: { description: 'Queued webhook event' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, queueEventSchema)
  return getServices().webhookService.queueEvent(body)
})
