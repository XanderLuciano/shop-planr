defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Bulk-update job priority ordering.',
    responses: {
      200: { description: 'Priorities updated' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { jobService } = getServices()
  return jobService.updatePriorities(body)
})
