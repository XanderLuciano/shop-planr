import { addLibraryEntrySchema } from '../../schemas/librarySchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'Add a new process to the library.',
    requestBody: zodRequestBody(addLibraryEntrySchema),
    responses: {
      201: { description: 'Process created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, addLibraryEntrySchema)
  const { libraryService } = getServices()
  return libraryService.addProcess(body.name)
})
