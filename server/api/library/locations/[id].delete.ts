export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { libraryService } = getServices()
  libraryService.removeLocation(id)
  return { success: true }
})
