import { updateAdvancementModeSchema } from '../../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateAdvancementModeSchema)
  const { pathService } = getServices()
  return pathService.updatePath(id, { advancementMode: body.advancementMode })
})
