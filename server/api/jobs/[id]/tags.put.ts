import { setJobTagsSchema } from '../../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, setJobTagsSchema)
  const { jobService } = getServices()
  return jobService.setJobTags(id, body.tagIds)
})
