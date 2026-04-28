import { createOverrideSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Create a step override for one or more parts.',
    requestBody: zodRequestBody(createOverrideSchema),
    responses: {
      200: { description: 'Step override created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createOverrideSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.createStepOverride(body.partIds || body.serialIds!, body.stepId, body.reason, userId)
})
