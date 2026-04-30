import { updateRegistrationSchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Update a webhook registration (admin only).',
    requestBody: zodRequestBody(updateRegistrationSchema),
    responses: {
      200: { description: 'Updated webhook registration' },
      400: { description: 'Validation error' },
      404: { description: 'Registration not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Registration ID is required')
  const userId = getAuthUserId(event)
  const body = await parseBody(event, updateRegistrationSchema)
  const { webhookRegistrationService } = getServices()
  return webhookRegistrationService.update(userId, id, body)
})
