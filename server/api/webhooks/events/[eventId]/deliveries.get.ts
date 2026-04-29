defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List all deliveries for a specific event with registration details.',
    responses: {
      200: { description: 'Array of delivery details' },
      404: { description: 'Event not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const eventId = getRouterParam(event, 'eventId')
  if (!eventId) throw new ValidationError('Event ID is required')
  const { webhookDeliveryService } = getServices()
  return webhookDeliveryService.listByEventId(eventId)
})
