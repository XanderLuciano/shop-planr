export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const userId = getAuthUserId(event)
  const { certService } = getServices()
  return certService.batchAttachCert({ ...body, userId })
})
