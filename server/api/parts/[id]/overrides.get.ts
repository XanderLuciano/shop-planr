export default defineEventHandler(async (event) => {
  const partId = getRouterParam(event, 'id')
  if (!partId) throw createError({ statusCode: 400, message: 'Part ID is required' })

  const { partStepOverrides } = getRepositories()
  return partStepOverrides.listByPartId(partId)
})
