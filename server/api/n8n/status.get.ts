export default defineApiHandler(async (_event) => {
  return await getServices().n8nAutomationService.getN8nStatus()
})
