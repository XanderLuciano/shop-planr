import { batchUpdateStatusSchema } from '../../../schemas/webhookSchemas'

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
