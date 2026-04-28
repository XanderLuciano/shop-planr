defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Get tags assigned to a job.',
    responses: {
      200: { description: 'List of tags for the job' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Job ID is required')
  getAuthUserId(event) // ensure caller is authenticated
  const { tagService } = getServices()
  return tagService.getTagsByJobId(id)
})
