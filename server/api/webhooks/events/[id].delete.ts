export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Event ID is required')

  getServices().webhookService.deleteEvent(id)
  return { success: true }
})
