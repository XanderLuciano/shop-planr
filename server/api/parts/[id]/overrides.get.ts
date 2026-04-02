export default defineApiHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw new ValidationError('Part ID is required')

  const { partStepOverrides } = getRepositories()
  return partStepOverrides.listByPartId(partId)
})
