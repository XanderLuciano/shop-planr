export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  return getServices().n8nAutomationService.getById(id)
})
