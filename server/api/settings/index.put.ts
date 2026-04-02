export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { settingsService } = getServices()
  return settingsService.updateSettings(body)
})
