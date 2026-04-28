import { advanceToStepSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Advance a part to a specific target step.',
    requestBody: zodRequestBody(advanceToStepSchema),
    responses: {
      200: { description: 'Part advanced to target step' },
      400: { description: 'Validation error' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, advanceToStepSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.advanceToStep(id, { ...body, userId })
})
