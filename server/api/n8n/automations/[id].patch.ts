import { updateN8nAutomationSchema } from '../../../schemas/n8nAutomationSchemas'
import type { N8nWorkflowDefinition } from '../../../types/domain'

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
