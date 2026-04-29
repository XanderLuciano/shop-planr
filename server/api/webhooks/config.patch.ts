import { updateConfigSchema } from '../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Update webhook configuration. Requires admin privileges. All fields are optional — only provided fields are changed.',
    requestBody: zodRequestBody(updateConfigSchema),
    responses: {
      200: { description: 'Updated webhook configuration' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const body = await parseBody(event, updateConfigSchema)
  return getServices().webhookService.updateConfig(userId, body)
})
