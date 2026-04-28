defineRouteMeta({
  openAPI: {
    tags: ['Jira'],
    description: 'Get details for a specific Jira ticket by key.',
    responses: {
      200: { description: 'Jira ticket details' },
      400: { description: 'Jira integration not enabled' },
      404: { description: 'Ticket not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { settingsService, jiraService } = getServices()

  const jiraConnection = settingsService.getJiraConnection()
  if (!jiraConnection.enabled) {
    throw new ValidationError('Jira integration is not enabled')
  }

  const key = getRouterParam(event, 'key')!
  return await jiraService.fetchTicketDetail(key)
})
