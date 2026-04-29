import { batchDeliveryStatusSchema } from '../../../schemas/webhookRegistrationSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Batch update delivery statuses with lifecycle validation.',
    requestBody: zodRequestBody(batchDeliveryStatusSchema),
    responses: {
      200: { description: 'Batch status update successful' },
      400: { description: 'Validation error (invalid transition)' },
      404: { description: 'Delivery not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchDeliveryStatusSchema)
  const { webhookDeliveryService } = getServices()
  webhookDeliveryService.batchUpdateStatus(body.deliveries)
  return { ok: true }
})
