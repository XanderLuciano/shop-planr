import { createCertSchema } from '../../schemas/certSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Certificates'],
    description: 'Create a new certificate.',
    requestBody: zodRequestBody(createCertSchema),
    responses: {
      201: { description: 'Certificate created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createCertSchema)
  const { certService } = getServices()
  return certService.createCert(body)
})
