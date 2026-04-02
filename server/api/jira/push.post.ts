export default defineApiHandler(async (event) => {
  const { settingsService, jiraService } = getServices()

  const conn = settingsService.getJiraConnection()
  if (!conn.enabled) {
    throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
  }
  if (!conn.pushEnabled) {
    throw createError({ statusCode: 400, message: 'Jira push is not enabled' })
  }

  const body = await readBody(event)
  const { jobId } = body as { jobId: string }

  if (!jobId) {
    throw new ValidationError('jobId is required')
  }

  return await jiraService.pushDescriptionTable(jobId)
})
