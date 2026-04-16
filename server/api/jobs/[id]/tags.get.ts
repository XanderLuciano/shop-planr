export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Job ID is required')
  getAuthUserId(event) // ensure caller is authenticated
  const { tagService } = getServices()
  return tagService.getTagsByJobId(id)
})
