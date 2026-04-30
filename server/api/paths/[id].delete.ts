defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Delete a path by ID (admin only, cascades dependents).',
    responses: {
      200: { description: 'Path deleted' },
      403: { description: 'Forbidden — admin required' },
      404: { description: 'Path not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { pathService } = getServices()
  // Look up path info before deletion for the webhook payload
  const path = pathService.getPath(id)
  const result = pathService.deletePath(id, userId)
  emitWebhookEvent('path_deleted', {
    user: resolveUserName(userId),
    pathId: id,
    pathName: path.name,
    jobId: path.jobId,
    deletedPartIds: result.deletedPartIds,
  })
  return { success: true, ...result }
})
