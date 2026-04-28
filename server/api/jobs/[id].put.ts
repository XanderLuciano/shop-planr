import { updateJobSchema } from '../../schemas/jobSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Update an existing job.',
    requestBody: zodRequestBody(updateJobSchema),
    responses: {
      200: { description: 'Job updated' },
      400: { description: 'Validation error' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateJobSchema)
  const { jobService } = getServices()
  return jobService.updateJob(id, body)
})
