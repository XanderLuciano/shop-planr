export default defineApiHandler(async (event) => {
  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : 100

  return getServices().webhookService.listQueuedEvents(limit)
})
