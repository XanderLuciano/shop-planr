import { assignStepSchema } from '../../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, assignStepSchema)
  const { pathService } = getServices()
  return pathService.assignStep(id, body.userId)
})
