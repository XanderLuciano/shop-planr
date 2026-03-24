export default defineEventHandler(async (event) => {
  try {
    const { settingsService, jiraService } = getServices()

    const jiraConnection = settingsService.getJiraConnection()
    if (!jiraConnection.enabled) {
      throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
    }

    const key = getRouterParam(event, 'key')!
    return await jiraService.fetchTicketDetail(key)
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
