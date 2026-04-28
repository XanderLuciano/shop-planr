defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Compute progress for all active jobs.',
    responses: {
      200: { description: 'Progress data for all jobs' },
    },
  },
})

export default defineApiHandler(async () => {
  const { jobService } = getServices()
  return jobService.computeAllJobProgress()
})
