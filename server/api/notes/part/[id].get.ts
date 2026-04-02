export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { noteService } = getServices()
  return noteService.getNotesForPart(id)
})
