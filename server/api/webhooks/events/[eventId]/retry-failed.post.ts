defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Re-queue failed deliveries for an event (admin only). Transitions failed deliveries back to queued.',
    responses: {
      200: { description: 'Array of retried deliveries' },
      404: { description: 'Event not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw new ValidationError('Event ID is required')
  const userId = getAuthUserId(event)
  const { webhookDeliveryService } = getServices()
  return webhookDeliveryService.retryFailed(userId, eventId)
})
