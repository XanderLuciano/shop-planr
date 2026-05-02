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
  const userName = resolveUserName(userId)
  const advancedPartIds = result.results.filter(r => r.success && r.newStatus !== 'completed').map(r => r.partId)
  const completedPartIds = result.results.filter(r => r.success && r.newStatus === 'completed').map(r => r.partId)
  const firstAdvanced = advancedPartIds[0]
  const firstCompleted = completedPartIds[0]
  if (advancedPartIds.length > 0 && firstAdvanced) {
    emitWebhookEvent('part_advanced', {
      user: userName,
      partIds: advancedPartIds,
      advancedCount: advancedPartIds.length,
      failedCount: result.failed,
      ...resolvePathInfo(firstAdvanced),
    })
  }
  if (completedPartIds.length > 0 && firstCompleted) {
    emitWebhookEvent('part_completed', {
      user: userName,
      partIds: completedPartIds,
      count: completedPartIds.length,
      ...resolvePathInfo(firstCompleted),
    })
  }
  return result
})
