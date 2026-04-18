import { batchStepStatusesSchema } from '../../schemas/partSchemas'
import type { PartStepStatusView } from '../../types/computed'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchStepStatusesSchema)
  const { lifecycleService } = getServices()

  const result: Record<string, PartStepStatusView[]> = {}

  for (const partId of body.partIds) {
    try {
      result[partId] = lifecycleService.getStepStatusViews(partId)
    } catch {
      // Omit missing parts — no error
    }
  }

  return result
})
