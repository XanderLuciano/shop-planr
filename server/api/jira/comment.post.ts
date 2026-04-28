defineRouteMeta({
  openAPI: {
    tags: ['Jira'],
    description: 'Push a note or summary comment to the linked Jira ticket.',
    responses: {
      200: { description: 'Comment pushed to Jira' },
      400: { description: 'Validation error or Jira push not enabled' },
    },
  },
})

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
  const { jobId, noteId } = body as { jobId: string, noteId?: string }

  if (!jobId) {
    throw new ValidationError('jobId is required')
  }

  if (noteId) {
    return await jiraService.pushNoteAsComment(noteId, jobId)
  }

  return await jiraService.pushCommentSummary(jobId)
})
