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
  const { certService } = getServices()
  const userName = resolveUserName(userId)
  const cert = certService.getCert(body.certId)
  const result = certService.batchAttachCert({ ...body, userId })
  emitWebhookEvent('cert_attached', {
    user: userName,
    certId: body.certId,
    certName: cert.name,
    certType: cert.type,
    partIds: result.map(a => a.partId),
    count: result.length,
    stepId: result[0]?.stepId,
  })
  return result
})
