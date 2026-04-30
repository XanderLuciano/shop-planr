export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  const userId = getAuthUserId(event)
  return await getServices().n8nAutomationService.deploy(id, userId)
})
