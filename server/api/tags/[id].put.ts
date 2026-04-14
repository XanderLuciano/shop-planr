import { updateTagSchema } from '../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { tagService, userService } = getServices()
  const user = userService.getUser(userId)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const body = await parseBody(event, updateTagSchema)
  return tagService.updateTag(id, body)
})
