import { deletePathSchema } from '../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, deletePathSchema)
  const { pathService } = getServices()
  const result = pathService.deletePath(id, body.userId)
  return { success: true, ...result }
})
