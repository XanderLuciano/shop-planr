export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { partService } = getServices()
  return partService.batchCreateParts(body, body.userId || 'anonymous')
})
