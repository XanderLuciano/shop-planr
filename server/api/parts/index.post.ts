defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Batch-create parts for a path.',
    responses: {
      201: { description: 'Parts created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  return partService.batchCreateParts(body, userId)
})
