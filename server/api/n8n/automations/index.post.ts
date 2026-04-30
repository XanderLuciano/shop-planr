import { createN8nAutomationSchema } from '../../../schemas/n8nAutomationSchemas'

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const body = await parseBody(event, createN8nAutomationSchema)
  return getServices().n8nAutomationService.create({
    ...body,
    workflowJson: body.workflowJson as import('../../../../server/types/domain').N8nWorkflowDefinition,
  }, userId)
})
