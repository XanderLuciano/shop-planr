import { setJobTagsSchema } from '../../../schemas/tagSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Set tags for a job (replaces existing tags).',
    requestBody: zodRequestBody(setJobTagsSchema),
    responses: {
      200: { description: 'Job tags updated' },
      400: { description: 'Validation error' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Job ID is required')
  const userId = getAuthUserId(event)
  const body = await parseBody(event, setJobTagsSchema)
  const { jobService } = getServices()
  return jobService.setJobTags(userId, id, body.tagIds)
})
