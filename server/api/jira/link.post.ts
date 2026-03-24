export default defineEventHandler(async (event) => {
  try {
    const { settingsService, jiraService, templateService } = getServices()

    const jiraConnection = settingsService.getJiraConnection()
    if (!jiraConnection.enabled) {
      throw createError({ statusCode: 400, message: 'Jira integration is not enabled' })
    }

    const body = await readBody(event)
    const { ticketKey, goalQuantity, templateId } = body as {
      ticketKey: string
      goalQuantity?: number
      templateId?: string
    }

    if (!ticketKey) {
      throw new ValidationError('ticketKey is required')
    }

    // Create job from Jira ticket
    const job = await jiraService.linkTicketToJob({ ticketKey, goalQuantity })

    // If a template was specified, apply it to create a path on the new job
    let path = null
    if (templateId) {
      path = templateService.applyTemplate(templateId, {
        jobId: job.id,
        goalQuantity: job.goalQuantity
      })
    }

    return { job, path }
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
