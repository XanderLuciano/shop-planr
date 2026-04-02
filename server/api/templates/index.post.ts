export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { templateService } = getServices()
  return templateService.createTemplate(body)
})
