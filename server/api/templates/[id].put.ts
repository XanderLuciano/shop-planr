defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Update a route template.',
    responses: {
      200: { description: 'Template updated' },
      400: { description: 'Validation error' },
      404: { description: 'Template not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { templateService } = getServices()
  return templateService.updateTemplate(id, body)
})
