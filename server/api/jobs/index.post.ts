defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Create a new production job.',
    responses: {
      201: { description: 'Job created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { jobService } = getServices()
  return jobService.createJob(body)
})
