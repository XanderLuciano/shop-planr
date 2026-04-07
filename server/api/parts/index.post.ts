export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  return partService.batchCreateParts(body, userId)
})
