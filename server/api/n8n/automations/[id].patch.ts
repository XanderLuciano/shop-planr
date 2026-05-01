import { updateN8nAutomationSchema } from '../../../schemas/n8nAutomationSchemas'
import type { N8nWorkflowDefinition } from '../../../types/domain'

defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Update an existing n8n automation (admin only).',
    requestBody: zodRequestBody(updateN8nAutomationSchema),
    responses: {
      200: { description: 'Updated N8nAutomation object' },
      400: { description: 'Validation error' },
      403: { description: 'Admin access required' },
      404: { description: 'Automation not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Automation ID is required')
  const userId = getAuthUserId(event)
  const body = await parseBody(event, updateN8nAutomationSchema)
  return getServices().n8nAutomationService.update(id, {
    ...body,
    workflowJson: body.workflowJson as N8nWorkflowDefinition | undefined,
  }, userId)
})
