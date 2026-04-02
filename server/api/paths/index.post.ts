export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { pathService } = getServices()
  return pathService.createPath(body)
})
