defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Apply a template to create a path on a job.',
    responses: {
      201: { description: 'Path created from template' },
      400: { description: 'Validation error' },
      404: { description: 'Template not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { templateService } = getServices()
  return templateService.applyTemplate(id, body)
})
