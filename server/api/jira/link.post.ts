defineRouteMeta({
  openAPI: {
    tags: ['Jira'],
    description: 'Link a Jira ticket to a new job, optionally applying a template.',
    responses: {
      201: { description: 'Job created from Jira ticket' },
      400: { description: 'Validation error or Jira not enabled' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { settingsService, jiraService, templateService } = getServices()

  const jiraConnection = settingsService.getJiraConnection()
  if (!jiraConnection.enabled) {
    throw new ValidationError('Jira integration is not enabled')
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
      goalQuantity: job.goalQuantity,
    })
  }

  return { job, path }
})
