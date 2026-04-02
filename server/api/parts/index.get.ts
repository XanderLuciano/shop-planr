export default defineApiHandler(async () => {
  const { partService } = getServices()
  return partService.listAllPartsEnriched()
})
