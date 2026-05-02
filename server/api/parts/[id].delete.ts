import { partIdParamSchema } from '../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Delete a part by ID (admin only, cascades dependents).',
    responses: {
      200: { description: 'Part deleted' },
      403: { description: 'Forbidden — admin required' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler((event) => {
  const parseResult = partIdParamSchema.safeParse({ id: getRouterParam(event, 'id') })
  if (!parseResult.success) {
    throw new ValidationError(
      parseResult.error.issues.map(i => i.message).join('; '),
    )
  }
  const { id } = parseResult.data
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  // Resolve path/job info before the part is deleted — afterwards the
  // lookups will miss.
  const pathInfo = resolvePathInfo(id)
  const result = partService.deletePart(id, userId)
  emitWebhookEvent('part_deleted', {
    user: resolveUserName(userId),
    partId: id,
    ...pathInfo,
  })
  return { success: true, ...result }
})
