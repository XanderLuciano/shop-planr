export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { tagService } = getServices()
  return tagService.getTagsByJobId(id)
})
