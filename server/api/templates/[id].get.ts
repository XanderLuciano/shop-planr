export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { templateService } = getServices()
  return templateService.getTemplate(id)
})
