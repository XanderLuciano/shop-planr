defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Create a new route template.',
    responses: {
      201: { description: 'Template created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { templateService } = getServices()
  return templateService.createTemplate(body)
})
