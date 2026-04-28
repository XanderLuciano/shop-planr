defineRouteMeta({
  openAPI: {
    tags: ['Notes'],
    description: 'Get all notes for a specific step.',
    responses: {
      200: { description: 'List of notes for the step' },
      404: { description: 'Step not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { noteService } = getServices()
  return noteService.getNotesForStep(id)
})
