export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { certService } = getServices()
  return certService.batchAttachCert(body)
})
