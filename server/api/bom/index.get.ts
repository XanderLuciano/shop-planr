import { bomListQuerySchema } from '../../schemas/bomSchemas'
import { parseQuery } from '../../utils/validation'

export default defineApiHandler(async (event) => {
  const { status } = parseQuery(event, bomListQuerySchema)
  const { bomService } = getServices()
  return bomService.listBoms(status)
})
