export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { partService } = getServices()
  return partService.advancePart(id, body.userId || 'anonymous')
})
