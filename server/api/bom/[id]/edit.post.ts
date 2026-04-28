import { editBomSchema } from '../../../schemas/bomSchemas'
import { parseBody } from '../../../utils/validation'

defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'Edit a BOM with a versioned change description.',
    requestBody: zodRequestBody(editBomSchema),
    responses: {
      200: { description: 'BOM edited and version created' },
      400: { description: 'Validation error' },
      404: { description: 'BOM not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, editBomSchema)
  const userId = getAuthUserId(event)
  const { bomService } = getServices()
  return bomService.editBom(id, { ...body, userId })
})
