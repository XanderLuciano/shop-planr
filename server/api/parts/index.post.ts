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
  const { partService } = getServices()
  return partService.batchCreateParts(body, userId)
})
