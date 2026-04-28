defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Get step status views for a part.',
    responses: {
      200: { description: 'Step statuses for the part' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw new ValidationError('Part ID is required')

  const { lifecycleService } = getServices()
  return lifecycleService.getStepStatusViews(partId)
})
