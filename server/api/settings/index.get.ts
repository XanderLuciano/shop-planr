export default defineApiHandler(async () => {
  const { settingsService } = getServices()
  return settingsService.getSettings()
})
