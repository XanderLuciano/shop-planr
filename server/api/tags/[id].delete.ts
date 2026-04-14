export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const userId = getAuthUserId(event)
  const { tagService, userService } = getServices()
  const user = userService.getUser(userId)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  tagService.deleteTag(id)
  setResponseStatus(event, 204)
  return null
})
