import { createBomSchema } from '../../schemas/bomSchemas'
import { parseBody } from '../../utils/validation'

defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'Create a new bill of materials.',
    requestBody: zodRequestBody(createBomSchema),
    responses: {
      201: { description: 'BOM created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createBomSchema)
  const { bomService } = getServices()
  return bomService.createBom(body)
})
