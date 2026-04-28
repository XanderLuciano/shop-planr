import { queueEventSchema } from '../../../schemas/webhookSchemas'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, queueEventSchema)
  return getServices().webhookService.queueEvent(body)
})
