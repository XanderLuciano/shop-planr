defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Get a job by ID with its paths and progress.',
    responses: {
      200: { description: 'Job details' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { jobService, pathService } = getServices()
  const job = jobService.getJob(id)
  const paths = pathService.listPathsByJob(id)
  const progress = jobService.computeJobProgress(id)
  return { ...job, paths, progress }
})
