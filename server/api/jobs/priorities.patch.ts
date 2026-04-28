import { updatePrioritiesSchema } from '../../schemas/jobSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Bulk-update job priority ordering.',
    requestBody: zodRequestBody(updatePrioritiesSchema),
    responses: {
      200: { description: 'Priorities updated' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, updatePrioritiesSchema)
  const { jobService } = getServices()
  return jobService.updatePriorities(body)
})
