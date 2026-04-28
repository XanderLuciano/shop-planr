defineRouteMeta({
  openAPI: {
    tags: ['Jira'],
    description: 'Fetch open Jira tickets.',
    responses: {
      200: { description: 'List of open Jira tickets' },
      400: { description: 'Jira integration not enabled' },
    },
  },
})

export default defineApiHandler(async () => {
  const { settingsService, jiraService } = getServices()

  const jiraConnection = settingsService.getJiraConnection()
  if (!jiraConnection.enabled) {
    throw new ValidationError('Jira integration is not enabled')
  }

  return await jiraService.fetchOpenTickets()
})
