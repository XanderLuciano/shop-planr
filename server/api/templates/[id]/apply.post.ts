export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { templateService } = getServices()
  return templateService.applyTemplate(id, body)
})
