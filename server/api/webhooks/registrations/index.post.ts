import { createRegistrationSchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Create a new webhook registration (admin only).',
    requestBody: zodRequestBody(createRegistrationSchema),
    responses: {
      200: { description: 'Created webhook registration' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const body = await parseBody(event, createRegistrationSchema)
  const { webhookRegistrationService } = getServices()
  return webhookRegistrationService.create(userId, body)
})
