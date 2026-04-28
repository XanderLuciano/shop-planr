import { assignStepSchema } from '../../../schemas/pathSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Steps'],
    description: 'Assign or unassign a user to a process step.',
    requestBody: zodRequestBody(assignStepSchema),
    responses: {
      200: { description: 'Step assignment updated' },
      400: { description: 'Validation error' },
      404: { description: 'Step not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, assignStepSchema)
  const { pathService } = getServices()
  return pathService.assignStep(id, body.userId)
})
