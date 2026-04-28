export default defineApiHandler(async () => {
  const count = getServices().webhookService.requeueAllFailed()
  return { requeued: count }
})
