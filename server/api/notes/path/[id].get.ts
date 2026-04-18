import { pathIdParamSchema } from '../../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const parseResult = pathIdParamSchema.safeParse({ id: getRouterParam(event, 'id') })
  if (!parseResult.success) {
    throw new ValidationError(
      parseResult.error.issues.map(i => i.message).join('; '),
    )
  }
  const { id: pathId } = parseResult.data
  const { noteService, pathService } = getServices()

  // Verify path exists — throws NotFoundError → 404
  pathService.getPath(pathId)

  return noteService.getNotesForPath(pathId)
})
