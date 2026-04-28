import { updateBomSchema } from '../../schemas/bomSchemas'
import { parseBody } from '../../utils/validation'

defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'Update a BOM (name and/or entries).',
    requestBody: zodRequestBody(updateBomSchema),
    responses: {
      200: { description: 'BOM updated' },
      400: { description: 'Validation error' },
      404: { description: 'BOM not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateBomSchema)
  const { bomService } = getServices()
  return bomService.updateBom(id, body)
})
