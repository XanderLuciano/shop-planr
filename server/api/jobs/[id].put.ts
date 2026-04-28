defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Update an existing job.',
    responses: {
      200: { description: 'Job updated' },
      400: { description: 'Validation error' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { jobService } = getServices()
  return jobService.updateJob(id, body)
})
