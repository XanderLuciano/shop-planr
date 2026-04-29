import { updateEventStatusSchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Update the status of a webhook event (sent, failed, or requeue).',
    requestBody: zodRequestBody(updateEventStatusSchema),
    responses: {
      200: { description: 'Updated webhook event' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Event ID is required')

  const body = await parseBody(event, updateEventStatusSchema)
  const { webhookService } = getServices()

  if (body.status === 'sent') {
    return webhookService.markSent(id)
  } else if (body.status === 'failed') {
    return webhookService.markFailed(id, body.error ?? 'Unknown error')
  } else {
    return webhookService.requeueEvent(id)
  }
})
