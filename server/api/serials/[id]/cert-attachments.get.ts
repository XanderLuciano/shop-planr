export default defineEventHandler(async (event) => {
  const serialId = getRouterParam(event, 'id')
  if (!serialId) throw createError({ statusCode: 400, message: 'Serial ID is required' })

  const { certService } = getServices()
  return certService.getAttachmentsBySerialId(serialId)
})
