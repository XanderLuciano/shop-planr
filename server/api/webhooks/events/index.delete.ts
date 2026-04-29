defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Delete all webhook events. Requires admin privileges.',
    responses: {
      200: { description: 'Count of deleted events' },
      403: { description: 'Admin access required' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const deleted = getServices().webhookService.clearAllEvents(userId)
  return { deleted }
})
