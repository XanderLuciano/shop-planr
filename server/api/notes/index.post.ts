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
  return noteService.createNote({ ...body, userId })
})
