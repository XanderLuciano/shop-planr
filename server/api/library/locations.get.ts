export default defineEventHandler(async () => {
  const { libraryService } = getServices()
  return libraryService.listLocations()
})
