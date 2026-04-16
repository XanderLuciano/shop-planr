import { setJobTagsSchema } from '../../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Job ID is required')
  const userId = getAuthUserId(event)
  const body = await parseBody(event, setJobTagsSchema)
  const { jobService } = getServices()
  return jobService.setJobTags(userId, id, body.tagIds)
})
