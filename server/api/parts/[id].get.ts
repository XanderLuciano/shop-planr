export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { partService, certService } = getServices()
  const part = partService.getPart(id)
  const certs = certService.getCertsForSerial(id)
  return { ...part, certs }
})
