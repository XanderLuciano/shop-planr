import { addLibraryEntrySchema } from '../../schemas/librarySchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'Add a new location to the library.',
    requestBody: zodRequestBody(addLibraryEntrySchema),
    responses: {
      201: { description: 'Location created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, addLibraryEntrySchema)
  const { libraryService } = getServices()
  return libraryService.addLocation(body.name)
})
