export default defineApiHandler(async () => {
  const { tagService } = getServices()
  return tagService.listTags()
})
