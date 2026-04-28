import { batchAdvanceSchema } from '../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Batch-advance multiple parts to their next step.',
    requestBody: zodRequestBody(batchAdvanceSchema),
    responses: {
      200: { description: 'Parts advanced' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchAdvanceSchema)
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  return partService.batchAdvanceParts(body.partIds, userId)
})
