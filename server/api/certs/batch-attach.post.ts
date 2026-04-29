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
  const result = certService.batchAttachCert({ ...body, userId })
  const userName = resolveUserName(userId)
  for (const attachment of result) {
    emitWebhookEvent('cert_attached', {
      user: userName,
      certId: body.certId,
      partId: attachment.partId,
      stepId: attachment.stepId,
    })
  }
  return result
})
