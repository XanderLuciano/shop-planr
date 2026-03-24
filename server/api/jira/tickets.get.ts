export default defineEventHandler(async () => {
  try {
    const { settingsService, jiraService } = getServices()

    const jiraConnection = settingsService.getJiraConnection()
    if (!jiraConnection.enabled) {
      throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
    }

    return await jiraService.fetchOpenTickets()
  } catch (error) {
    if (error instanceof ValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
