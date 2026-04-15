import { updateTagSchema } from '../../schemas/tagSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Tag ID is required')
  const userId = getAuthUserId(event)
  const { tagService, userService } = getServices()
  const user = userService.getUser(userId)
  if (!user.isAdmin) {
    throw new ForbiddenError('Admin access required')
  }
  const body = await parseBody(event, updateTagSchema)
  return tagService.updateTag(id, body)
})
