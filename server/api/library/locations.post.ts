defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'Add a new location to the library.',
    responses: {
      201: { description: 'Location created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { libraryService } = getServices()
  return libraryService.addLocation(body.name)
})
