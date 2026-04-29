import { batchUpdateStatusSchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Batch update the status of multiple webhook events (sent or failed).',
    requestBody: zodRequestBody(batchUpdateStatusSchema),
    responses: {
      200: { description: 'Array of updated webhook events' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchUpdateStatusSchema)
  const { webhookService } = getServices()

  const results = body.events.map((e) => {
    if (e.status === 'sent') {
      return webhookService.markSent(e.id)
    } else {
      return webhookService.markFailed(e.id, e.error ?? 'Unknown error')
    }
  })

  return results
})
