export default defineApiHandler(async () => {
  const deleted = getServices().webhookService.clearAllEvents()
  return { deleted }
})
