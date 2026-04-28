defineRouteMeta({
  openAPI: {
    tags: ['Settings'],
    description: 'Get application settings.',
    responses: {
      200: { description: 'Current settings' },
    },
  },
})

export default defineApiHandler(async () => {
  const { settingsService } = getServices()
  return settingsService.getSettings()
})
