import { createTagSchema } from '../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const { tagService, userService } = getServices()
  const user = userService.getUser(userId)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const body = await parseBody(event, createTagSchema)
  return tagService.createTag(body)
})
