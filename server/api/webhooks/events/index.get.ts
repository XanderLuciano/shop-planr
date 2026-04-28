export default defineApiHandler(async (event) => {
  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : 200
  const offset = query.offset ? Number(query.offset) : 0

  return getServices().webhookService.listEvents({ limit, offset })
})
