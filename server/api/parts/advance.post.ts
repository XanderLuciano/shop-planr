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
  const result = partService.batchAdvanceParts(body.partIds, userId)
  const advancedPartIds = result.results.filter(r => r.success).map(r => r.partId)
  if (advancedPartIds.length > 0) {
    emitWebhookEvent('part_advanced', {
      user: resolveUserName(userId),
      partIds: advancedPartIds,
      advancedCount: result.advanced,
      failedCount: result.failed,
    })
  }
  return result
})
