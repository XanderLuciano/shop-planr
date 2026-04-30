import { createJobSchema } from '../../schemas/jobSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Create a new production job.',
    requestBody: zodRequestBody(createJobSchema),
    responses: {
      201: { description: 'Job created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createJobSchema)
  const userId = getAuthUserId(event)
  const { jobService } = getServices()
  const job = jobService.createJob(body)
  emitWebhookEvent('job_created', {
    user: resolveUserName(userId),
    jobId: job.id,
    jobName: job.name,
    goalQuantity: job.goalQuantity,
  })
  return job
})
