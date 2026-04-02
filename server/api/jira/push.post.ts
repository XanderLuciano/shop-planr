export default defineApiHandler(async (event) => {
  const { settingsService, jiraService } = getServices()

  const conn = settingsService.getJiraConnection()
  if (!conn.enabled) {
    throw new ValidationError('Jira integration is not enabled')
  }
  if (!conn.pushEnabled) {
    throw new ValidationError('Jira push is not enabled')
  }

  const body = await readBody(event)
  const { jobId } = body as { jobId: string }

  if (!jobId) {
    throw new ValidationError('jobId is required')
  }

  return await jiraService.pushDescriptionTable(jobId)
})
