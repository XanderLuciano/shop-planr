export default defineApiHandler(async () => {
  const { templateService } = getServices()
  return templateService.listTemplates()
})
