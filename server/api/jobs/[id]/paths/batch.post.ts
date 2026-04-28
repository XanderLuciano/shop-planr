import { batchPathOperationsSchema } from '../../../../schemas/pathSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Batch create, update, and delete paths for a job.',
    requestBody: zodRequestBody(batchPathOperationsSchema),
    responses: {
      200: { description: 'Batch operations completed' },
      400: { description: 'Validation error' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')!
  const body = await parseBody(event, batchPathOperationsSchema)
  const userId = getAuthUserId(event)
  const { pathService, jobService } = getServices()

  // Verify job exists — throws NotFoundError → 404
  jobService.getJob(jobId)

  return pathService.batchPathOperations({
    jobId,
    userId,
    create: body.create,
    update: body.update,
    delete: body.delete,
  })
})
