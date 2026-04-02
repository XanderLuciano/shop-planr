export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { pathService } = getServices()
  return pathService.updatePath(id, { advancementMode: body.advancementMode })
})
