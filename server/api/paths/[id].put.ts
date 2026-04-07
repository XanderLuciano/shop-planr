import { updatePathSchema } from '../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updatePathSchema)
  const { pathService } = getServices()
  return pathService.updatePath(id, body)
})
