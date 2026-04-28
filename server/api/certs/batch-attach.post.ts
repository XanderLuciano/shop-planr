import { batchAttachCertSchema } from '../../schemas/certSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'Batch-attach a certificate to multiple parts at their current step.',
    requestBody: zodRequestBody(batchAttachCertSchema),
    responses: {
      200: { description: 'Certificate attached to parts' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchAttachCertSchema)
  const userId = getAuthUserId(event)
  const { partService, pathService, certService } = getServices()

  // Resolve each part's current step (same pattern as single attach-cert route)
  const attachments = body.partIds.map((partId) => {
    const part = partService.getPart(partId)
    const path = pathService.getPath(part.pathId)
    const step = part.currentStepId !== null
      ? path.steps.find(s => s.id === part.currentStepId)
      : undefined
    if (!step) {
      throw new ValidationError(`Part ${partId} is already completed, cannot attach cert`)
    }
    return { partId, stepId: step.id, jobId: part.jobId, pathId: part.pathId }
  })

  return certService.batchAttachCertWithSteps({
    certId: body.certId,
    attachments,
    userId,
  })
})
