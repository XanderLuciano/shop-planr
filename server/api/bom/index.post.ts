import { createBomSchema } from '../../schemas/bomSchemas'
import { parseBody } from '../../utils/validation'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createBomSchema)
  const { bomService } = getServices()
  return bomService.createBom(body)
})
