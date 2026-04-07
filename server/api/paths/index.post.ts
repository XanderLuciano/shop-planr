import { createPathSchema } from '../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createPathSchema)
  const { pathService } = getServices()
  return pathService.createPath(body)
})
