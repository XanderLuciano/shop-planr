import { createN8nAutomationSchema } from '../../../schemas/n8nAutomationSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Create a new n8n automation (admin only).',
    requestBody: zodRequestBody(createN8nAutomationSchema),
    responses: {
      200: { description: 'Created N8nAutomation object' },
      400: { description: 'Validation error' },
      403: { description: 'Admin access required' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const body = await parseBody(event, createN8nAutomationSchema)
  return getServices().n8nAutomationService.create({
    ...body,
    workflowJson: body.workflowJson as import('../../../../server/types/domain').N8nWorkflowDefinition,
  }, userId)
})
