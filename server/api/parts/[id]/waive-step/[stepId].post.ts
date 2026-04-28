import { waiveStepSchema } from '../../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Waive a step for a part (skip with approval).',
    requestBody: zodRequestBody(waiveStepSchema),
    responses: {
      200: { description: 'Step waived' },
      400: { description: 'Validation error' },
      404: { description: 'Part or step not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const stepId = getRouterParam(event, 'stepId')!
  const userId = getAuthUserId(event)
  const body = await parseBody(event, waiveStepSchema)
  const { lifecycleService } = getServices()
  return lifecycleService.waiveStep(id, stepId, { ...body, approverId: userId })
})
