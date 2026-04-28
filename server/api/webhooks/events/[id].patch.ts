import { updateEventStatusSchema } from '../../../schemas/webhookSchemas'

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
