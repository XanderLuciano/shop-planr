export default defineApiHandler(async () => {
  const { certService } = getServices()
  return certService.listCerts()
})
