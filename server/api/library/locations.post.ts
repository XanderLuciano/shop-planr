export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { libraryService } = getServices()
  return libraryService.addLocation(body.name)
})
