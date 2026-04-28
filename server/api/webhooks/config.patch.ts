import { updateConfigSchema } from '../../schemas/webhookSchemas'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, updateConfigSchema)
  return getServices().webhookService.updateConfig(body)
})
