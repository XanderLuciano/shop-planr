defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Get step overrides for a part.',
    responses: {
      200: { description: 'List of step overrides' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw new ValidationError('Part ID is required')

  const { partStepOverrides } = getRepositories()
  return partStepOverrides.listByPartId(partId)
})
