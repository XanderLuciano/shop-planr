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
  const { jobService } = getServices()
  return jobService.createJob(body)
})
