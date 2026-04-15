export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Job ID is required')
  const { tagService } = getServices()
  return tagService.getTagsByJobId(id)
})
