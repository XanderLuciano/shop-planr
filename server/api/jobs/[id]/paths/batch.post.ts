import { batchPathOperationsSchema } from '../../../../schemas/pathSchemas'

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
