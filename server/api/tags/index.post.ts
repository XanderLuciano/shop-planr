import { createTagSchema } from '../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const body = await parseBody(event, createTagSchema)
  const { tagService } = getServices()
  return tagService.createTag(userId, body)
})
