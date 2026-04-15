import { createTagSchema } from '../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const { tagService, userService } = getServices()
  const user = userService.getUser(userId)
  if (!user.isAdmin) {
    throw new ForbiddenError('Admin access required')
  }
  const body = await parseBody(event, createTagSchema)
  return tagService.createTag(body)
})
