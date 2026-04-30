import { forceCompleteSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Force-complete a part, skipping remaining steps.',
    requestBody: zodRequestBody(forceCompleteSchema),
    responses: {
      200: { description: 'Part force-completed' },
      400: { description: 'Validation error' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, forceCompleteSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  const result = lifecycleService.forceComplete(id, { ...body, userId })
  emitWebhookEvent('part_force_completed', {
    user: resolveUserName(userId),
    partId: id,
    reason: body.reason,
    ...resolvePathInfo(id),
  })
  return result
})
