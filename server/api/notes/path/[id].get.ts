export default defineApiHandler(async (event) => {
  const pathId = getRouterParam(event, 'id')!
  const { noteService, pathService } = getServices()

  // Verify path exists — throws NotFoundError → 404
  pathService.getPath(pathId)

  return noteService.getNotesForPath(pathId)
})
