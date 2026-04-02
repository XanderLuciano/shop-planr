export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { certService } = getServices()
  return certService.getAttachmentsByCertId(id)
})
