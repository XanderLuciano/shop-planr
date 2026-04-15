export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Tag ID is required')
  const userId = getAuthUserId(event)
  const force = getQuery(event).force === 'true'
  const { tagService } = getServices()
  tagService.deleteTag(userId, id, { force })
  setResponseStatus(event, 204)
  return null
})
