defineRouteMeta({
  openAPI: {
    tags: ['Notes'],
    description: 'Get all notes for a specific part.',
    responses: {
      200: { description: 'List of notes for the part' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { noteService } = getServices()
  return noteService.getNotesForPart(id)
})
