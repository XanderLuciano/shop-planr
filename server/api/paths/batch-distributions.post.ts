import { batchDistributionsSchema } from '../../schemas/pathSchemas'
import type { StepDistribution } from '../../types/computed'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchDistributionsSchema)
  const { pathService } = getServices()

  const result: Record<string, { distribution: StepDistribution[], completedCount: number }> = {}

  for (const pathId of body.pathIds) {
    try {
      const distribution = pathService.getStepDistribution(pathId)
      const completedCount = pathService.getPathCompletedCount(pathId)
      result[pathId] = { distribution, completedCount }
    } catch {
      // Omit missing paths — no error
    }
  }

  return result
})
