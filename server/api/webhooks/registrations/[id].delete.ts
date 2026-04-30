defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Delete a webhook registration with cascade (admin only). Queued deliveries are canceled.',
    responses: {
      204: { description: 'Registration deleted' },
      404: { description: 'Registration not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Registration ID is required')
  const userId = getAuthUserId(event)
  const { webhookRegistrationService } = getServices()
  webhookRegistrationService.delete(userId, id)
  return sendNoContent(event)
})
