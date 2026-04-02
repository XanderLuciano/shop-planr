export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { libraryService } = getServices()
  libraryService.removeProcess(id)
  return { success: true }
})
