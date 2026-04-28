defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'List all production jobs with their tags.',
    responses: {
      200: { description: 'List of jobs' },
    },
  },
})

export default defineApiHandler(async () => {
  const { jobService } = getServices()
  return jobService.listJobsWithTags()
})
