import { updateDeliveryStatusSchema } from '../../../schemas/webhookSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Update a single delivery status with lifecycle validation.',
    requestBody: zodRequestBody(updateDeliveryStatusSchema),
    responses: {
      200: { description: 'Updated webhook delivery' },
      400: { description: 'Validation error (invalid transition)' },
      404: { description: 'Delivery not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  requireAdmin(getRepositories().users, userId, 'update webhook delivery status')
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Delivery ID is required')
  const body = await parseBody(event, updateDeliveryStatusSchema)
  const { webhookDeliveryService } = getServices()
  return webhookDeliveryService.updateStatus(id, body.status, body.error)
})
