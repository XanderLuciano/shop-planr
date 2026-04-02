export default defineApiHandler(async () => {
  const { libraryService } = getServices()
  return libraryService.listProcesses()
})
