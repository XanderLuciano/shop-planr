import { batchDistributionsSchema } from '../../schemas/pathSchemas'
import type { StepDistribution } from '../../types/computed'
import { NotFoundError } from '../../utils/errors'

defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Fetch step distributions and completed counts for multiple paths.',
    requestBody: zodRequestBody(batchDistributionsSchema),
    responses: {
      200: { description: 'Batch distribution results' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchDistributionsSchema)
  const { pathService } = getServices()

  const result: Record<string, { distribution: StepDistribution[], completedCount: number }> = {}

  for (const pathId of body.pathIds) {
    try {
      const distribution = pathService.getStepDistribution(pathId)
      const completedCount = pathService.getPathCompletedCount(pathId)
      result[pathId] = { distribution, completedCount }
    } catch (err) {
      if (err instanceof NotFoundError) continue
      throw err
    }
  }

  return result
})
