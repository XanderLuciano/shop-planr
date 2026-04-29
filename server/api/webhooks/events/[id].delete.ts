defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Delete a webhook event by ID.',
    responses: {
      200: { description: 'Event deleted' },
      400: { description: 'Validation error (missing ID)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Event ID is required')
  const userId = getAuthUserId(event)

  getServices().webhookService.deleteEvent(userId, id)
  return { success: true }
})
