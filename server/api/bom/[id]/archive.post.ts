import { archiveBomSchema } from '../../../schemas/bomSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, archiveBomSchema)
  const { bomService } = getServices()
  return bomService.archiveBom(id, body.userId)
})
