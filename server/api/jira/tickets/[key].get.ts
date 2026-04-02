export default defineApiHandler(async (event) => {
  const { settingsService, jiraService } = getServices()

  const jiraConnection = settingsService.getJiraConnection()
  if (!jiraConnection.enabled) {
    throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
  }

  const key = getRouterParam(event, 'key')!
  return await jiraService.fetchTicketDetail(key)
})
