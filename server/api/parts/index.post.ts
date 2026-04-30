import { createPartsSchema } from '../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Batch-create parts for a path.',
    requestBody: zodRequestBody(createPartsSchema),
    responses: {
      201: { description: 'Parts created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createPartsSchema)
  const userId = getAuthUserId(event)
  const { partService, jobService, pathService } = getServices()
  const parts = partService.batchCreateParts(body, userId)
  const userName = resolveUserName(userId)
  const job = jobService.getJob(body.jobId)
  const path = pathService.getPath(body.pathId)
  emitWebhookEvent('part_created', {
    user: userName,
    partIds: parts.map(p => p.id),
    count: parts.length,
    jobId: body.jobId,
    jobName: job.name,
    pathId: body.pathId,
    pathName: path.name,
  })
  return parts
})
