import { updateBomSchema } from '../../schemas/bomSchemas'
import { parseBody } from '../../utils/validation'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateBomSchema)
  const { bomService } = getServices()
  return bomService.updateBom(id, body)
})
