import { editBomSchema } from '../../../schemas/bomSchemas'
import { parseBody } from '../../../utils/validation'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, editBomSchema)
  const userId = getAuthUserId(event)
  const { bomService } = getServices()
  return bomService.editBom(id, { ...body, userId })
})
