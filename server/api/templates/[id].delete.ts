defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Delete a route template by ID.',
    responses: {
      204: { description: 'Template deleted' },
      404: { description: 'Template not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { templateService } = getServices()
  const deleted = templateService.deleteTemplate(id)
  if (!deleted) {
    throw new NotFoundError('TemplateRoute', id)
  }
  return { success: true }
})
