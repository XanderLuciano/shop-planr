export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  const userId = getAuthUserId(event)
  getServices().n8nAutomationService.delete(id, userId)
  return { success: true }
})
