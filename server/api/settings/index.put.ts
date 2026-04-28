import { updateSettingsSchema } from '../../schemas/settingsSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Settings'],
    description: 'Update application settings.',
    requestBody: zodRequestBody(updateSettingsSchema),
    responses: {
      200: { description: 'Settings updated' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, updateSettingsSchema)
  const { settingsService } = getServices()
  return settingsService.updateSettings(body)
})
