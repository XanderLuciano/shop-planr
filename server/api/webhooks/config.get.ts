export default defineApiHandler(async () => {
  return getServices().webhookService.getConfig()
})
