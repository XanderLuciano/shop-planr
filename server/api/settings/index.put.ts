defineRouteMeta({
  openAPI: {
    tags: ['Settings'],
    description: 'Update application settings.',
    responses: {
      200: { description: 'Settings updated' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { settingsService } = getServices()
  return settingsService.updateSettings(body)
})
