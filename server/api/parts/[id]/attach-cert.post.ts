import { attachCertSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Attach a certificate to a part at its current step.',
    requestBody: zodRequestBody(attachCertSchema),
    responses: {
      200: { description: 'Certificate attached' },
      400: { description: 'Validation error or part already completed' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, attachCertSchema)
  const userId = getAuthUserId(event)
  const { partService, certService, pathService } = getServices()

  const part = partService.getPart(id)
  const path = pathService.getPath(part.pathId)
  const step = part.currentStepId !== null ? path.steps.find(s => s.id === part.currentStepId) : undefined
  if (!step) {
    throw new ValidationError('Part is already completed, cannot attach cert')
  }

  const cert = certService.getCert(body.certId)
  const attachment = certService.attachCertToSerial({
    certId: body.certId,
    serialId: id,
    stepId: step.id,
    userId,
    jobId: part.jobId,
    pathId: part.pathId,
  })
  emitWebhookEvent('cert_attached', {
    user: resolveUserName(userId),
    certId: body.certId,
    certName: cert.name,
    certType: cert.type,
    partId: id,
    stepId: step.id,
  })
  return attachment
})
