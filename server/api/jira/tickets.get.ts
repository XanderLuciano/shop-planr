export default defineApiHandler(async () => {
  const { settingsService, jiraService } = getServices()

  const jiraConnection = settingsService.getJiraConnection()
  if (!jiraConnection.enabled) {
    throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
  }

  return await jiraService.fetchOpenTickets()
})
