import { batchAttachCertSchema } from '../../schemas/certSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'Batch-attach a certificate to multiple parts.',
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
  return certService.batchAttachCert({ ...body, userId })
})
