import { updateSettingsSchema } from '../../schemas/settingsSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Settings'],
    description: 'Update application settings. Credential-bearing fields (jiraConnection, n8nConnection) require admin privileges.',
    requestBody: zodRequestBody(updateSettingsSchema),
    responses: {
      200: { description: 'Settings updated' },
      400: { description: 'Validation error' },
      403: { description: 'Admin access required for integration credentials' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, updateSettingsSchema)
  const userId = getAuthUserId(event)
  const { settingsService } = getServices()
  return settingsService.updateSettings(body, userId)
})
