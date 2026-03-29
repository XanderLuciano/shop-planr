export default defineEventHandler(async (event) => {
  try {
    const { settingsService, jiraService } = getServices()

    const conn = settingsService.getJiraConnection()
    if (!conn.enabled) {
      throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
    }
    if (!conn.pushEnabled) {
      throw createError({ statusCode: 400, message: 'Jira push is not enabled' })
    }

    const body = await readBody(event)
    const { jobId, noteId } = body as { jobId: string; noteId?: string }

    if (!jobId) {
      throw new ValidationError('jobId is required')
    }

    if (noteId) {
      return await jiraService.pushNoteAsComment(noteId, jobId)
    }

    return await jiraService.pushCommentSummary(jobId)
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
