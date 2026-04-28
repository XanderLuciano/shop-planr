defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Get a route template by ID.',
    responses: {
      200: { description: 'Template details' },
      404: { description: 'Template not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { templateService } = getServices()
  return templateService.getTemplate(id)
})
