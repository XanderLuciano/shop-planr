defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'List all route templates.',
    responses: {
      200: { description: 'List of templates' },
    },
  },
})

export default defineApiHandler(async () => {
  const { templateService } = getServices()
  return templateService.listTemplates()
})
