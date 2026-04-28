defineRouteMeta({
  openAPI: {
    tags: ['Tags'],
    description: 'List all tags.',
    responses: {
      200: { description: 'List of tags' },
    },
  },
})

export default defineApiHandler(async () => {
  const { tagService } = getServices()
  return tagService.listTags()
})
