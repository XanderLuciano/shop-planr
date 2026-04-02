export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { certService } = getServices()
  return certService.createCert(body)
})
