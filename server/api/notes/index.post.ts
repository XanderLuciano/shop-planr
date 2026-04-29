import { createNoteSchema } from '../../schemas/noteSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Notes'],
    description: 'Create a new step note.',
    requestBody: zodRequestBody(createNoteSchema),
    responses: {
      201: { description: 'Note created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createNoteSchema)
  const userId = getAuthUserId(event)
  const { noteService } = getServices()
  const note = noteService.createNote({ ...body, userId })
  emitWebhookEvent('note_created', {
    user: resolveUserName(userId),
    noteId: note.id,
    stepId: body.stepId,
    partIds: body.partIds,
    text: body.text,
  })
  return note
})
