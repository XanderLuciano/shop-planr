export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body?.userId) throw new ValidationError('userId is required')
  const { pathService } = getServices()
  const result = pathService.deletePath(id, body.userId)
  return { success: true, ...result }
})
