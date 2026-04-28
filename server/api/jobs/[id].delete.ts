defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Delete a job by ID (admin only).',
    responses: {
      204: { description: 'Job deleted' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler((event) => {
  const id = getRouterParam(event, 'id')!
  const { jobService } = getServices()
  jobService.deleteJob(id)
  setResponseStatus(event, 204)
  return null
})
