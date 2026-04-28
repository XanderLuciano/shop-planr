import { bomListQuerySchema } from '../../schemas/bomSchemas'
import { parseQuery } from '../../utils/validation'

defineRouteMeta({
  openAPI: {
    tags: ['BOM'],
    description: 'List all bills of materials.',
    parameters: [
      {
        in: 'query',
        name: 'status',
        description: 'Filter by BOM status (active, archived, or all)',
        schema: { type: 'string', enum: ['active', 'archived', 'all'], default: 'active' },
      },
    ],
    responses: {
      200: { description: 'List of BOMs' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { status } = parseQuery(event, bomListQuerySchema)
  const { bomService } = getServices()
  return bomService.listBoms(status)
})
