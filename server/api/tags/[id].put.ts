import { updateTagSchema } from '../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Tag ID is required')
  const userId = getAuthUserId(event)
  const body = await parseBody(event, updateTagSchema)
  const { tagService } = getServices()
  return tagService.updateTag(userId, id, body)
})
