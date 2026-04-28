import { batchStepStatusesSchema } from '../../schemas/partSchemas'
import type { PartStepStatusView } from '../../types/computed'
import { NotFoundError } from '../../utils/errors'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Batch-fetch step statuses for multiple parts.',
    requestBody: zodRequestBody(batchStepStatusesSchema),
    responses: {
      200: { description: 'Step statuses keyed by part ID' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchStepStatusesSchema)
  const { lifecycleService } = getServices()

  const result: Record<string, PartStepStatusView[]> = {}

  for (const partId of body.partIds) {
    try {
      result[partId] = lifecycleService.getStepStatusViews(partId)
    } catch (err) {
      if (err instanceof NotFoundError) continue
      throw err
    }
  }

  return result
})
