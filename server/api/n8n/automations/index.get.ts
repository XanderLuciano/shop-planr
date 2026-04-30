export default defineApiHandler(async (_event) => {
  return getServices().n8nAutomationService.list()
})
