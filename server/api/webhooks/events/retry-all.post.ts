defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Requeue all failed webhook events back to queued status. Requires admin privileges.',
    responses: {
      200: { description: 'Count of requeued events' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const count = getServices().webhookService.requeueAllFailed(userId)
  return { requeued: count }
})
