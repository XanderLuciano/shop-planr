export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { bomService } = getServices()
  return bomService.createBom(body)
})
