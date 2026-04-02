export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { templateService } = getServices()
  const deleted = templateService.deleteTemplate(id)
  if (!deleted) {
    throw new NotFoundError('TemplateRoute', id)
  }
  return { success: true }
})
