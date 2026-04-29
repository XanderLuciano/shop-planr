defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Re-queue all deliveries for an event (admin only). Creates new delivery records for all matching registrations.',
    responses: {
      200: { description: 'Array of newly created deliveries' },
      404: { description: 'Event not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw new ValidationError('Event ID is required')
  const userId = getAuthUserId(event)
  const { webhookDeliveryService } = getServices()
  return webhookDeliveryService.replayEvent(userId, eventId)
})
