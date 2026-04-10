import { batchAdvanceSchema } from '../../schemas/partSchemas'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchAdvanceSchema)
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  return partService.batchAdvanceParts(body.partIds, userId)
})
